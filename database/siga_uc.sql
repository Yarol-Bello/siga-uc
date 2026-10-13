--
-- PostgreSQL database dump
--

\restrict hBDz7fjlo2QAtY8Rgv4d10e7YDzFP8IeUQrCN0gvcSblnLhKNlDgkCsPtpfUtpr

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

-- Started on 2026-10-13 16:05:00

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 29048)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 5684 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 4 (class 3079 OID 29097)
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- TOC entry 5685 (class 0 OID 0)
-- Dependencies: 4
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- TOC entry 3 (class 3079 OID 29086)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 5686 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 360 (class 1255 OID 30132)
-- Name: calcular_nota_final_area(integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calcular_nota_final_area(p_id_alumno integer, p_id_curso integer, p_bimestre integer, p_anio integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total_ad INT;
    v_total_a  INT;
    v_total_b  INT;
    v_total_c  INT;
BEGIN
    SELECT
        COUNT(*) FILTER (WHERE calificacion = 'AD'),
        COUNT(*) FILTER (WHERE calificacion = 'A'),
        COUNT(*) FILTER (WHERE calificacion = 'B'),
        COUNT(*) FILTER (WHERE calificacion = 'C')
    INTO v_total_ad, v_total_a, v_total_b, v_total_c
    FROM calificaciones
    WHERE id_alumno = p_id_alumno
      AND id_curso  = p_id_curso
      AND bimestre  = p_bimestre
      AND anio_lectivo = p_anio;

    IF v_total_ad >= 2 THEN RETURN 'AD';
    ELSIF v_total_a >= 2 THEN RETURN 'A';
    ELSIF v_total_b >= 2 THEN RETURN 'B';
    ELSE RETURN 'C';
    END IF;
END;
$$;


ALTER FUNCTION public.calcular_nota_final_area(p_id_alumno integer, p_id_curso integer, p_bimestre integer, p_anio integer) OWNER TO postgres;

--
-- TOC entry 354 (class 1255 OID 30128)
-- Name: trg_actualizar_pension(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_actualizar_pension() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.id_pension IS NOT NULL THEN
        UPDATE pensiones SET estado = 'PAGADO' WHERE id_pension = NEW.id_pension;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_actualizar_pension() OWNER TO postgres;

--
-- TOC entry 353 (class 1255 OID 30126)
-- Name: trg_actualizar_preticket(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_actualizar_preticket() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.id_preticket IS NOT NULL THEN
        UPDATE pre_tickets
        SET estado = 'PAGADO', fecha_pago = NOW()
        WHERE id_preticket = NEW.id_preticket;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_actualizar_preticket() OWNER TO postgres;

--
-- TOC entry 351 (class 1255 OID 30122)
-- Name: trg_actualizar_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_actualizar_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_actualizar_timestamp() OWNER TO postgres;

--
-- TOC entry 352 (class 1255 OID 30124)
-- Name: trg_auditar_calificacion(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_auditar_calificacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO bitacora_auditoria (
        id_usuario, modulo_afectado, accion, descripcion,
        valor_anterior, valor_nuevo
    ) VALUES (
        COALESCE(NEW.modificado_por, OLD.modificado_por, NULL),
        'Evaluaciones',
        CASE WHEN TG_OP = 'INSERT' THEN 'CREAR' ELSE 'MODIFICAR' END,
        'Calificación alumno ID ' || COALESCE(NEW.id_alumno, OLD.id_alumno),
        CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('calificacion', OLD.calificacion) ELSE NULL END,
        jsonb_build_object('calificacion', NEW.calificacion)
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_auditar_calificacion() OWNER TO postgres;

--
-- TOC entry 355 (class 1255 OID 30130)
-- Name: trg_pago_a_caja(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_pago_a_caja() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_apertura INT;
BEGIN
    SELECT id_apertura INTO v_apertura
    FROM aperturas_caja
    ORDER BY fecha_apertura DESC LIMIT 1;

    IF v_apertura IS NOT NULL THEN
        INSERT INTO movimientos_caja (
            id_apertura, id_pago, tipo, concepto, monto, medio_pago, id_usuario
        ) VALUES (
            v_apertura, NEW.id_pago, 'INGRESO',
            'Cobro registrado - Pago ID ' || NEW.id_pago,
            NEW.monto, NEW.forma_pago, NEW.id_usuario_cobrador
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_pago_a_caja() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 269 (class 1259 OID 29697)
-- Name: actas_bimestrales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.actas_bimestrales (
    id_acta integer NOT NULL,
    periodo character varying(30) NOT NULL,
    anio_lectivo integer NOT NULL,
    id_grado integer,
    estado character varying(20) DEFAULT 'ABIERTO'::character varying NOT NULL,
    fecha_cierre timestamp without time zone,
    cerrado_por integer,
    hash_integridad character varying(255),
    CONSTRAINT chk_acta_estado CHECK (((estado)::text = ANY ((ARRAY['ABIERTO'::character varying, 'CERRADO'::character varying])::text[])))
);


ALTER TABLE public.actas_bimestrales OWNER TO postgres;

--
-- TOC entry 268 (class 1259 OID 29696)
-- Name: actas_bimestrales_id_acta_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.actas_bimestrales_id_acta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.actas_bimestrales_id_acta_seq OWNER TO postgres;

--
-- TOC entry 5687 (class 0 OID 0)
-- Dependencies: 268
-- Name: actas_bimestrales_id_acta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.actas_bimestrales_id_acta_seq OWNED BY public.actas_bimestrales.id_acta;


--
-- TOC entry 255 (class 1259 OID 29442)
-- Name: alumnos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alumnos (
    id_alumno integer NOT NULL,
    id_usuario integer NOT NULL,
    dni character(8) NOT NULL,
    nombres character varying(100) NOT NULL,
    apellidos character varying(100) NOT NULL,
    fecha_nacimiento date NOT NULL,
    id_apoderado integer,
    id_grado integer,
    condicion character varying(20) DEFAULT 'Regular'::character varying NOT NULL,
    colegio_procedencia character varying(200),
    estado_matricula character varying(30) DEFAULT 'PendientePago'::character varying NOT NULL,
    fecha_retiro date,
    motivo_retiro character varying(200),
    colegio_destino character varying(200),
    resolucion_directoral character varying(100),
    codigo_estudiante character varying(20),
    anio_lectivo integer NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_alumno_condicion CHECK (((condicion)::text = ANY ((ARRAY['Regular'::character varying, 'Traslado'::character varying, 'Retirado'::character varying])::text[]))),
    CONSTRAINT chk_alumno_dni CHECK ((dni ~ '^[0-9]{8}$'::text)),
    CONSTRAINT chk_alumno_estado CHECK (((estado_matricula)::text = ANY ((ARRAY['Matriculado'::character varying, 'PendientePago'::character varying, 'Retirado'::character varying])::text[])))
);


ALTER TABLE public.alumnos OWNER TO postgres;

--
-- TOC entry 254 (class 1259 OID 29441)
-- Name: alumnos_id_alumno_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alumnos_id_alumno_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alumnos_id_alumno_seq OWNER TO postgres;

--
-- TOC entry 5688 (class 0 OID 0)
-- Dependencies: 254
-- Name: alumnos_id_alumno_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alumnos_id_alumno_seq OWNED BY public.alumnos.id_alumno;


--
-- TOC entry 299 (class 1259 OID 30093)
-- Name: alumnos_riesgo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alumnos_riesgo (
    id_riesgo integer NOT NULL,
    id_alumno integer NOT NULL,
    id_grado integer NOT NULL,
    bimestre integer NOT NULL,
    cursos_logro_c text,
    id_tutor integer,
    accion_correctiva text
);


ALTER TABLE public.alumnos_riesgo OWNER TO postgres;

--
-- TOC entry 298 (class 1259 OID 30092)
-- Name: alumnos_riesgo_id_riesgo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alumnos_riesgo_id_riesgo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alumnos_riesgo_id_riesgo_seq OWNER TO postgres;

--
-- TOC entry 5689 (class 0 OID 0)
-- Dependencies: 298
-- Name: alumnos_riesgo_id_riesgo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alumnos_riesgo_id_riesgo_seq OWNED BY public.alumnos_riesgo.id_riesgo;


--
-- TOC entry 287 (class 1259 OID 29929)
-- Name: aperturas_caja; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.aperturas_caja (
    id_apertura integer NOT NULL,
    id_caja integer NOT NULL,
    monto_inicial numeric(10,2) NOT NULL,
    id_usuario_apertura integer,
    fecha_apertura timestamp without time zone DEFAULT now() NOT NULL,
    observaciones text
);


ALTER TABLE public.aperturas_caja OWNER TO postgres;

--
-- TOC entry 286 (class 1259 OID 29928)
-- Name: aperturas_caja_id_apertura_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.aperturas_caja_id_apertura_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.aperturas_caja_id_apertura_seq OWNER TO postgres;

--
-- TOC entry 5690 (class 0 OID 0)
-- Dependencies: 286
-- Name: aperturas_caja_id_apertura_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.aperturas_caja_id_apertura_seq OWNED BY public.aperturas_caja.id_apertura;


--
-- TOC entry 253 (class 1259 OID 29430)
-- Name: apoderados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.apoderados (
    id_apoderado integer NOT NULL,
    nombres character varying(100) NOT NULL,
    apellidos character varying(100) NOT NULL,
    dni character(8),
    telefono character varying(15),
    correo character varying(150)
);


ALTER TABLE public.apoderados OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 29429)
-- Name: apoderados_id_apoderado_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.apoderados_id_apoderado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.apoderados_id_apoderado_seq OWNER TO postgres;

--
-- TOC entry 5691 (class 0 OID 0)
-- Dependencies: 252
-- Name: apoderados_id_apoderado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.apoderados_id_apoderado_seq OWNED BY public.apoderados.id_apoderado;


--
-- TOC entry 259 (class 1259 OID 29510)
-- Name: asistencia_alumnos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asistencia_alumnos (
    id_asistencia integer NOT NULL,
    id_alumno integer NOT NULL,
    id_curso integer NOT NULL,
    id_personal integer,
    id_grado integer NOT NULL,
    fecha date NOT NULL,
    dia_semana character varying(15),
    estado character(1) NOT NULL,
    observacion character varying(250),
    justificada boolean DEFAULT false NOT NULL,
    motivo_justificacion character varying(250),
    fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_asistencia_estado CHECK ((estado = ANY (ARRAY['P'::bpchar, 'T'::bpchar, 'F'::bpchar])))
);


ALTER TABLE public.asistencia_alumnos OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 29509)
-- Name: asistencia_alumnos_id_asistencia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asistencia_alumnos_id_asistencia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asistencia_alumnos_id_asistencia_seq OWNER TO postgres;

--
-- TOC entry 5692 (class 0 OID 0)
-- Dependencies: 258
-- Name: asistencia_alumnos_id_asistencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asistencia_alumnos_id_asistencia_seq OWNED BY public.asistencia_alumnos.id_asistencia;


--
-- TOC entry 231 (class 1259 OID 29195)
-- Name: asistencia_personal; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asistencia_personal (
    id_asistencia_personal integer NOT NULL,
    id_personal integer NOT NULL,
    fecha date NOT NULL,
    hora_ingreso time without time zone,
    hora_salida time without time zone,
    estado character varying(20),
    observacion character varying(200),
    CONSTRAINT chk_asis_personal_estado CHECK ((((estado)::text = ANY ((ARRAY['Puntual'::character varying, 'Tardanza'::character varying, 'Falta'::character varying])::text[])) OR (estado IS NULL)))
);


ALTER TABLE public.asistencia_personal OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 29194)
-- Name: asistencia_personal_id_asistencia_personal_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asistencia_personal_id_asistencia_personal_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asistencia_personal_id_asistencia_personal_seq OWNER TO postgres;

--
-- TOC entry 5693 (class 0 OID 0)
-- Dependencies: 230
-- Name: asistencia_personal_id_asistencia_personal_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asistencia_personal_id_asistencia_personal_seq OWNED BY public.asistencia_personal.id_asistencia_personal;


--
-- TOC entry 275 (class 1259 OID 29759)
-- Name: becas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.becas (
    id_beca integer NOT NULL,
    id_alumno integer NOT NULL,
    tipo character varying(50) NOT NULL,
    porcentaje_descuento numeric(5,2) NOT NULL,
    monto_descuento numeric(10,2),
    fecha_inicio date NOT NULL,
    fecha_fin date,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_beca_porc CHECK (((porcentaje_descuento >= (0)::numeric) AND (porcentaje_descuento <= (100)::numeric))),
    CONSTRAINT chk_beca_tipo CHECK (((tipo)::text = ANY ((ARRAY['SOCIOECONOMICA'::character varying, 'HERMANOS'::character varying, 'EXCELENCIA'::character varying])::text[])))
);


ALTER TABLE public.becas OWNER TO postgres;

--
-- TOC entry 274 (class 1259 OID 29758)
-- Name: becas_id_beca_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.becas_id_beca_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.becas_id_beca_seq OWNER TO postgres;

--
-- TOC entry 5694 (class 0 OID 0)
-- Dependencies: 274
-- Name: becas_id_beca_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.becas_id_beca_seq OWNED BY public.becas.id_beca;


--
-- TOC entry 233 (class 1259 OID 29214)
-- Name: bitacora_auditoria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bitacora_auditoria (
    id_bitacora bigint NOT NULL,
    id_usuario integer,
    fecha_hora timestamp without time zone DEFAULT now() NOT NULL,
    modulo_afectado character varying(100) NOT NULL,
    accion character varying(50) NOT NULL,
    descripcion text,
    valor_anterior jsonb,
    valor_nuevo jsonb,
    ip_origen character varying(45)
);


ALTER TABLE public.bitacora_auditoria OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 29213)
-- Name: bitacora_auditoria_id_bitacora_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bitacora_auditoria_id_bitacora_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bitacora_auditoria_id_bitacora_seq OWNER TO postgres;

--
-- TOC entry 5695 (class 0 OID 0)
-- Dependencies: 232
-- Name: bitacora_auditoria_id_bitacora_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bitacora_auditoria_id_bitacora_seq OWNED BY public.bitacora_auditoria.id_bitacora;


--
-- TOC entry 283 (class 1259 OID 29887)
-- Name: boletas_electronicas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.boletas_electronicas (
    id_boleta integer NOT NULL,
    id_pago integer NOT NULL,
    numero_boleta character varying(20) NOT NULL,
    serie character varying(10) NOT NULL,
    numero integer NOT NULL,
    fecha_emision timestamp without time zone DEFAULT now() NOT NULL,
    monto_total numeric(10,2) NOT NULL,
    estado_sunat character varying(20),
    xml_url character varying(255),
    pdf_url character varying(255),
    hash_cpe character varying(255),
    CONSTRAINT chk_boleta_estado CHECK ((((estado_sunat)::text = ANY ((ARRAY['ACEPTADO'::character varying, 'PENDIENTE'::character varying, 'RECHAZADO'::character varying])::text[])) OR (estado_sunat IS NULL)))
);


ALTER TABLE public.boletas_electronicas OWNER TO postgres;

--
-- TOC entry 282 (class 1259 OID 29886)
-- Name: boletas_electronicas_id_boleta_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.boletas_electronicas_id_boleta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.boletas_electronicas_id_boleta_seq OWNER TO postgres;

--
-- TOC entry 5696 (class 0 OID 0)
-- Dependencies: 282
-- Name: boletas_electronicas_id_boleta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.boletas_electronicas_id_boleta_seq OWNED BY public.boletas_electronicas.id_boleta;


--
-- TOC entry 285 (class 1259 OID 29912)
-- Name: cajas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cajas (
    id_caja integer NOT NULL,
    nombre_caja character varying(100) NOT NULL,
    responsable integer,
    estado character varying(20) DEFAULT 'CERRADA'::character varying NOT NULL,
    CONSTRAINT chk_caja_estado CHECK (((estado)::text = ANY ((ARRAY['ABIERTA'::character varying, 'CERRADA'::character varying])::text[])))
);


ALTER TABLE public.cajas OWNER TO postgres;

--
-- TOC entry 284 (class 1259 OID 29911)
-- Name: cajas_id_caja_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cajas_id_caja_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cajas_id_caja_seq OWNER TO postgres;

--
-- TOC entry 5697 (class 0 OID 0)
-- Dependencies: 284
-- Name: cajas_id_caja_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cajas_id_caja_seq OWNED BY public.cajas.id_caja;


--
-- TOC entry 263 (class 1259 OID 29581)
-- Name: calificaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calificaciones (
    id_calificacion integer NOT NULL,
    id_alumno integer NOT NULL,
    id_curso integer NOT NULL,
    id_competencia integer NOT NULL,
    id_personal integer,
    id_grado integer NOT NULL,
    bimestre integer NOT NULL,
    anio_lectivo integer NOT NULL,
    calificacion character varying(5) NOT NULL,
    fecha_registro timestamp without time zone DEFAULT now() NOT NULL,
    fecha_modificacion timestamp without time zone,
    modificado_por integer,
    justificacion_modificacion text,
    CONSTRAINT chk_calif_bim CHECK (((bimestre >= 1) AND (bimestre <= 4))),
    CONSTRAINT chk_calif_valor CHECK (((calificacion)::text = ANY ((ARRAY['AD'::character varying, 'A'::character varying, 'B'::character varying, 'C'::character varying])::text[])))
);


ALTER TABLE public.calificaciones OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 29580)
-- Name: calificaciones_id_calificacion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.calificaciones_id_calificacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calificaciones_id_calificacion_seq OWNER TO postgres;

--
-- TOC entry 5698 (class 0 OID 0)
-- Dependencies: 262
-- Name: calificaciones_id_calificacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.calificaciones_id_calificacion_seq OWNED BY public.calificaciones.id_calificacion;


--
-- TOC entry 245 (class 1259 OID 29332)
-- Name: carga_curricular; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carga_curricular (
    id_carga integer NOT NULL,
    id_grado integer NOT NULL,
    id_curso integer NOT NULL,
    id_personal integer NOT NULL,
    anio_lectivo integer NOT NULL,
    horas_asignadas integer
);


ALTER TABLE public.carga_curricular OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 29331)
-- Name: carga_curricular_id_carga_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.carga_curricular_id_carga_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.carga_curricular_id_carga_seq OWNER TO postgres;

--
-- TOC entry 5699 (class 0 OID 0)
-- Dependencies: 244
-- Name: carga_curricular_id_carga_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carga_curricular_id_carga_seq OWNED BY public.carga_curricular.id_carga;


--
-- TOC entry 291 (class 1259 OID 29983)
-- Name: cierres_caja; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cierres_caja (
    id_cierre integer NOT NULL,
    id_apertura integer NOT NULL,
    monto_apertura numeric(10,2) NOT NULL,
    total_ingresos_efectivo numeric(10,2) NOT NULL,
    total_ingresos_digital numeric(10,2) NOT NULL,
    total_egresos numeric(10,2) NOT NULL,
    efectivo_esperado numeric(10,2) NOT NULL,
    efectivo_fisico numeric(10,2) NOT NULL,
    diferencia numeric(10,2) NOT NULL,
    total_general numeric(10,2) NOT NULL,
    id_usuario_cierre integer,
    fecha_cierre timestamp without time zone DEFAULT now() NOT NULL,
    estado character varying(20) DEFAULT 'CUADRADO'::character varying NOT NULL,
    CONSTRAINT chk_cierre_estado CHECK (((estado)::text = ANY ((ARRAY['CUADRADO'::character varying, 'SOBRANTE'::character varying, 'FALTANTE'::character varying])::text[])))
);


ALTER TABLE public.cierres_caja OWNER TO postgres;

--
-- TOC entry 290 (class 1259 OID 29982)
-- Name: cierres_caja_id_cierre_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cierres_caja_id_cierre_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cierres_caja_id_cierre_seq OWNER TO postgres;

--
-- TOC entry 5700 (class 0 OID 0)
-- Dependencies: 290
-- Name: cierres_caja_id_cierre_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cierres_caja_id_cierre_seq OWNED BY public.cierres_caja.id_cierre;


--
-- TOC entry 243 (class 1259 OID 29316)
-- Name: competencias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.competencias (
    id_competencia integer NOT NULL,
    id_curso integer NOT NULL,
    nombre_competencia character varying(250) NOT NULL,
    orden integer
);


ALTER TABLE public.competencias OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 29315)
-- Name: competencias_id_competencia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.competencias_id_competencia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.competencias_id_competencia_seq OWNER TO postgres;

--
-- TOC entry 5701 (class 0 OID 0)
-- Dependencies: 242
-- Name: competencias_id_competencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.competencias_id_competencia_seq OWNED BY public.competencias.id_competencia;


--
-- TOC entry 273 (class 1259 OID 29745)
-- Name: conceptos_pago; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conceptos_pago (
    id_concepto integer NOT NULL,
    nombre character varying(100) NOT NULL,
    monto_base numeric(10,2) NOT NULL,
    tipo character varying(20) NOT NULL,
    mes integer,
    anio_lectivo integer NOT NULL,
    CONSTRAINT chk_concepto_mes CHECK ((((mes >= 1) AND (mes <= 12)) OR (mes IS NULL))),
    CONSTRAINT chk_concepto_tipo CHECK (((tipo)::text = ANY ((ARRAY['MATRICULA'::character varying, 'PENSION'::character varying, 'OTROS'::character varying])::text[])))
);


ALTER TABLE public.conceptos_pago OWNER TO postgres;

--
-- TOC entry 272 (class 1259 OID 29744)
-- Name: conceptos_pago_id_concepto_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conceptos_pago_id_concepto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conceptos_pago_id_concepto_seq OWNER TO postgres;

--
-- TOC entry 5702 (class 0 OID 0)
-- Dependencies: 272
-- Name: conceptos_pago_id_concepto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conceptos_pago_id_concepto_seq OWNED BY public.conceptos_pago.id_concepto;


--
-- TOC entry 267 (class 1259 OID 29665)
-- Name: conclusiones_descriptivas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conclusiones_descriptivas (
    id_conclusion integer NOT NULL,
    id_alumno integer NOT NULL,
    id_curso integer NOT NULL,
    bimestre integer NOT NULL,
    anio_lectivo integer NOT NULL,
    descripcion text NOT NULL,
    id_personal integer
);


ALTER TABLE public.conclusiones_descriptivas OWNER TO postgres;

--
-- TOC entry 266 (class 1259 OID 29664)
-- Name: conclusiones_descriptivas_id_conclusion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conclusiones_descriptivas_id_conclusion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conclusiones_descriptivas_id_conclusion_seq OWNER TO postgres;

--
-- TOC entry 5703 (class 0 OID 0)
-- Dependencies: 266
-- Name: conclusiones_descriptivas_id_conclusion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conclusiones_descriptivas_id_conclusion_seq OWNED BY public.conclusiones_descriptivas.id_conclusion;


--
-- TOC entry 237 (class 1259 OID 29264)
-- Name: credenciales_qr; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credenciales_qr (
    id_credencial integer NOT NULL,
    id_usuario integer NOT NULL,
    codigo_qr character varying(255) NOT NULL,
    tipo character varying(20) NOT NULL,
    fecha_emision timestamp without time zone DEFAULT now() NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_credencial_tipo CHECK (((tipo)::text = ANY ((ARRAY['ESTUDIANTE'::character varying, 'DOCENTE'::character varying, 'ADMIN'::character varying, 'SECRETARIA'::character varying])::text[])))
);


ALTER TABLE public.credenciales_qr OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 29263)
-- Name: credenciales_qr_id_credencial_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.credenciales_qr_id_credencial_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.credenciales_qr_id_credencial_seq OWNER TO postgres;

--
-- TOC entry 5704 (class 0 OID 0)
-- Dependencies: 236
-- Name: credenciales_qr_id_credencial_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.credenciales_qr_id_credencial_seq OWNED BY public.credenciales_qr.id_credencial;


--
-- TOC entry 297 (class 1259 OID 30068)
-- Name: cuadro_merito; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cuadro_merito (
    id_cuadro integer NOT NULL,
    id_alumno integer NOT NULL,
    id_grado integer NOT NULL,
    bimestre integer NOT NULL,
    anio_lectivo integer NOT NULL,
    puesto integer NOT NULL,
    predominancia_logro character varying(100),
    merito character varying(100)
);


ALTER TABLE public.cuadro_merito OWNER TO postgres;

--
-- TOC entry 296 (class 1259 OID 30067)
-- Name: cuadro_merito_id_cuadro_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cuadro_merito_id_cuadro_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cuadro_merito_id_cuadro_seq OWNER TO postgres;

--
-- TOC entry 5705 (class 0 OID 0)
-- Dependencies: 296
-- Name: cuadro_merito_id_cuadro_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cuadro_merito_id_cuadro_seq OWNED BY public.cuadro_merito.id_cuadro;


--
-- TOC entry 241 (class 1259 OID 29304)
-- Name: cursos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cursos (
    id_curso integer NOT NULL,
    nombre_curso character varying(100) NOT NULL,
    area_academica character varying(50) NOT NULL,
    horas_semanales integer
);


ALTER TABLE public.cursos OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 29303)
-- Name: cursos_id_curso_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cursos_id_curso_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cursos_id_curso_seq OWNER TO postgres;

--
-- TOC entry 5706 (class 0 OID 0)
-- Dependencies: 240
-- Name: cursos_id_curso_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cursos_id_curso_seq OWNED BY public.cursos.id_curso;


--
-- TOC entry 251 (class 1259 OID 29416)
-- Name: escala_calificacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.escala_calificacion (
    id_escala integer NOT NULL,
    codigo character varying(5) NOT NULL,
    descripcion character varying(100) NOT NULL,
    orden integer NOT NULL,
    CONSTRAINT chk_escala_codigo CHECK (((codigo)::text = ANY ((ARRAY['AD'::character varying, 'A'::character varying, 'B'::character varying, 'C'::character varying])::text[])))
);


ALTER TABLE public.escala_calificacion OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 29415)
-- Name: escala_calificacion_id_escala_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.escala_calificacion_id_escala_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.escala_calificacion_id_escala_seq OWNER TO postgres;

--
-- TOC entry 5707 (class 0 OID 0)
-- Dependencies: 250
-- Name: escala_calificacion_id_escala_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.escala_calificacion_id_escala_seq OWNED BY public.escala_calificacion.id_escala;


--
-- TOC entry 295 (class 1259 OID 30038)
-- Name: estado_carga_docentes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.estado_carga_docentes (
    id_estado_carga integer NOT NULL,
    id_personal integer NOT NULL,
    id_curso integer NOT NULL,
    id_grado integer NOT NULL,
    bimestre integer NOT NULL,
    total_alumnos integer NOT NULL,
    alumnos_calificados integer NOT NULL,
    porcentaje numeric(5,2),
    estado character varying(20),
    CONSTRAINT chk_estado_carga CHECK ((((estado)::text = ANY ((ARRAY['COMPLETO'::character varying, 'PENDIENTE'::character varying])::text[])) OR (estado IS NULL)))
);


ALTER TABLE public.estado_carga_docentes OWNER TO postgres;

--
-- TOC entry 294 (class 1259 OID 30037)
-- Name: estado_carga_docentes_id_estado_carga_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.estado_carga_docentes_id_estado_carga_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.estado_carga_docentes_id_estado_carga_seq OWNER TO postgres;

--
-- TOC entry 5708 (class 0 OID 0)
-- Dependencies: 294
-- Name: estado_carga_docentes_id_estado_carga_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.estado_carga_docentes_id_estado_carga_seq OWNED BY public.estado_carga_docentes.id_estado_carga;


--
-- TOC entry 257 (class 1259 OID 29492)
-- Name: expediente_alumno; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expediente_alumno (
    id_expediente integer NOT NULL,
    id_alumno integer NOT NULL,
    nivel_logro_actual character varying(5),
    asistencia_acumulada numeric(5,2),
    congelado boolean DEFAULT false NOT NULL
);


ALTER TABLE public.expediente_alumno OWNER TO postgres;

--
-- TOC entry 256 (class 1259 OID 29491)
-- Name: expediente_alumno_id_expediente_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.expediente_alumno_id_expediente_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.expediente_alumno_id_expediente_seq OWNER TO postgres;

--
-- TOC entry 5709 (class 0 OID 0)
-- Dependencies: 256
-- Name: expediente_alumno_id_expediente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.expediente_alumno_id_expediente_seq OWNED BY public.expediente_alumno.id_expediente;


--
-- TOC entry 293 (class 1259 OID 30015)
-- Name: exportaciones_siagie; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exportaciones_siagie (
    id_exportacion integer NOT NULL,
    id_grado integer,
    bimestre integer NOT NULL,
    anio_lectivo integer NOT NULL,
    nombre_archivo character varying(255) NOT NULL,
    fecha_generacion timestamp without time zone DEFAULT now() NOT NULL,
    id_usuario integer,
    estado character varying(20)
);


ALTER TABLE public.exportaciones_siagie OWNER TO postgres;

--
-- TOC entry 292 (class 1259 OID 30014)
-- Name: exportaciones_siagie_id_exportacion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exportaciones_siagie_id_exportacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exportaciones_siagie_id_exportacion_seq OWNER TO postgres;

--
-- TOC entry 5710 (class 0 OID 0)
-- Dependencies: 292
-- Name: exportaciones_siagie_id_exportacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exportaciones_siagie_id_exportacion_seq OWNED BY public.exportaciones_siagie.id_exportacion;


--
-- TOC entry 239 (class 1259 OID 29289)
-- Name: grados; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grados (
    id_grado integer NOT NULL,
    nombre_grado character varying(50) NOT NULL,
    nivel character varying(20) NOT NULL,
    seccion character varying(10) NOT NULL,
    anio_lectivo integer NOT NULL
);


ALTER TABLE public.grados OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 29288)
-- Name: grados_id_grado_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.grados_id_grado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grados_id_grado_seq OWNER TO postgres;

--
-- TOC entry 5711 (class 0 OID 0)
-- Dependencies: 238
-- Name: grados_id_grado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grados_id_grado_seq OWNED BY public.grados.id_grado;


--
-- TOC entry 249 (class 1259 OID 29385)
-- Name: horarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.horarios (
    id_horario integer NOT NULL,
    id_grado integer NOT NULL,
    id_curso integer,
    id_personal integer,
    dia_semana character varying(15) NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    tipo_bloque character varying(20),
    CONSTRAINT chk_horario_dia CHECK (((dia_semana)::text = ANY ((ARRAY['Lunes'::character varying, 'Martes'::character varying, 'Miércoles'::character varying, 'Jueves'::character varying, 'Viernes'::character varying, 'Sábado'::character varying])::text[]))),
    CONSTRAINT chk_horario_hora CHECK ((hora_fin > hora_inicio)),
    CONSTRAINT chk_horario_tipo CHECK ((((tipo_bloque)::text = ANY ((ARRAY['CLASE'::character varying, 'RECREO'::character varying, 'ALMUERZO'::character varying])::text[])) OR (tipo_bloque IS NULL)))
);


ALTER TABLE public.horarios OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 29384)
-- Name: horarios_id_horario_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.horarios_id_horario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.horarios_id_horario_seq OWNER TO postgres;

--
-- TOC entry 5712 (class 0 OID 0)
-- Dependencies: 248
-- Name: horarios_id_horario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.horarios_id_horario_seq OWNED BY public.horarios.id_horario;


--
-- TOC entry 271 (class 1259 OID 29720)
-- Name: libretas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.libretas (
    id_libreta integer NOT NULL,
    id_alumno integer NOT NULL,
    bimestre integer NOT NULL,
    anio_lectivo integer NOT NULL,
    id_tutor integer,
    fecha_emision timestamp without time zone DEFAULT now() NOT NULL,
    promedio_general character varying(5),
    asistencia_global numeric(5,2)
);


ALTER TABLE public.libretas OWNER TO postgres;

--
-- TOC entry 270 (class 1259 OID 29719)
-- Name: libretas_id_libreta_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.libretas_id_libreta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.libretas_id_libreta_seq OWNER TO postgres;

--
-- TOC entry 5713 (class 0 OID 0)
-- Dependencies: 270
-- Name: libretas_id_libreta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.libretas_id_libreta_seq OWNED BY public.libretas.id_libreta;


--
-- TOC entry 289 (class 1259 OID 29953)
-- Name: movimientos_caja; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.movimientos_caja (
    id_movimiento integer NOT NULL,
    id_apertura integer NOT NULL,
    id_pago integer,
    tipo character varying(20) NOT NULL,
    concepto character varying(250) NOT NULL,
    monto numeric(10,2) NOT NULL,
    medio_pago character varying(30),
    nro_comprobante character varying(50),
    fecha_hora timestamp without time zone DEFAULT now() NOT NULL,
    id_usuario integer,
    CONSTRAINT chk_mov_tipo CHECK (((tipo)::text = ANY ((ARRAY['INGRESO'::character varying, 'EGRESO'::character varying, 'APERTURA'::character varying])::text[])))
);


ALTER TABLE public.movimientos_caja OWNER TO postgres;

--
-- TOC entry 288 (class 1259 OID 29952)
-- Name: movimientos_caja_id_movimiento_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.movimientos_caja_id_movimiento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.movimientos_caja_id_movimiento_seq OWNER TO postgres;

--
-- TOC entry 5714 (class 0 OID 0)
-- Dependencies: 288
-- Name: movimientos_caja_id_movimiento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.movimientos_caja_id_movimiento_seq OWNED BY public.movimientos_caja.id_movimiento;


--
-- TOC entry 265 (class 1259 OID 29636)
-- Name: notas_finales_area; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notas_finales_area (
    id_nota_final integer NOT NULL,
    id_alumno integer NOT NULL,
    id_curso integer NOT NULL,
    bimestre integer NOT NULL,
    anio_lectivo integer NOT NULL,
    nota_final character varying(5) NOT NULL,
    calculo_automatico boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_nota_final_bim CHECK (((bimestre >= 1) AND (bimestre <= 4))),
    CONSTRAINT chk_nota_final_valor CHECK (((nota_final)::text = ANY ((ARRAY['AD'::character varying, 'A'::character varying, 'B'::character varying, 'C'::character varying])::text[])))
);


ALTER TABLE public.notas_finales_area OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 29635)
-- Name: notas_finales_area_id_nota_final_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notas_finales_area_id_nota_final_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notas_finales_area_id_nota_final_seq OWNER TO postgres;

--
-- TOC entry 5715 (class 0 OID 0)
-- Dependencies: 264
-- Name: notas_finales_area_id_nota_final_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notas_finales_area_id_nota_final_seq OWNED BY public.notas_finales_area.id_nota_final;


--
-- TOC entry 235 (class 1259 OID 29236)
-- Name: notificaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notificaciones (
    id_notificacion integer NOT NULL,
    id_usuario_destino integer NOT NULL,
    id_usuario_remitente integer,
    asunto character varying(200) NOT NULL,
    cuerpo text NOT NULL,
    leido boolean DEFAULT false NOT NULL,
    fecha_envio timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notificaciones OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 29235)
-- Name: notificaciones_id_notificacion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notificaciones_id_notificacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notificaciones_id_notificacion_seq OWNER TO postgres;

--
-- TOC entry 5716 (class 0 OID 0)
-- Dependencies: 234
-- Name: notificaciones_id_notificacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notificaciones_id_notificacion_seq OWNED BY public.notificaciones.id_notificacion;


--
-- TOC entry 281 (class 1259 OID 29842)
-- Name: pagos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pagos (
    id_pago integer NOT NULL,
    id_alumno integer NOT NULL,
    id_preticket integer,
    id_pension integer,
    id_concepto integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    forma_pago character varying(30) NOT NULL,
    nro_operacion character varying(50),
    fecha_pago timestamp without time zone DEFAULT now() NOT NULL,
    id_usuario_cobrador integer,
    estado character varying(20) DEFAULT 'PAGADO'::character varying NOT NULL,
    CONSTRAINT chk_pago_estado CHECK (((estado)::text = ANY ((ARRAY['PAGADO'::character varying, 'ANULADO'::character varying])::text[]))),
    CONSTRAINT chk_pago_forma CHECK (((forma_pago)::text = ANY ((ARRAY['Efectivo'::character varying, 'Yape'::character varying, 'Plin'::character varying, 'Interbank'::character varying, 'BCP'::character varying, 'BBVA'::character varying])::text[])))
);


ALTER TABLE public.pagos OWNER TO postgres;

--
-- TOC entry 280 (class 1259 OID 29841)
-- Name: pagos_id_pago_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pagos_id_pago_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pagos_id_pago_seq OWNER TO postgres;

--
-- TOC entry 5717 (class 0 OID 0)
-- Dependencies: 280
-- Name: pagos_id_pago_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pagos_id_pago_seq OWNED BY public.pagos.id_pago;


--
-- TOC entry 277 (class 1259 OID 29780)
-- Name: pensiones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pensiones (
    id_pension integer NOT NULL,
    id_alumno integer NOT NULL,
    anio_lectivo integer NOT NULL,
    mes integer NOT NULL,
    monto_base numeric(10,2) NOT NULL,
    descuento numeric(10,2) DEFAULT 0 NOT NULL,
    monto_final numeric(10,2) NOT NULL,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    id_beca integer,
    CONSTRAINT chk_pension_estado CHECK (((estado)::text = ANY ((ARRAY['PAGADO'::character varying, 'PENDIENTE'::character varying])::text[]))),
    CONSTRAINT chk_pension_mes CHECK (((mes >= 1) AND (mes <= 12)))
);


ALTER TABLE public.pensiones OWNER TO postgres;

--
-- TOC entry 276 (class 1259 OID 29779)
-- Name: pensiones_id_pension_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pensiones_id_pension_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pensiones_id_pension_seq OWNER TO postgres;

--
-- TOC entry 5718 (class 0 OID 0)
-- Dependencies: 276
-- Name: pensiones_id_pension_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pensiones_id_pension_seq OWNED BY public.pensiones.id_pension;


--
-- TOC entry 229 (class 1259 OID 29178)
-- Name: personal; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.personal (
    id_personal integer NOT NULL,
    id_usuario integer NOT NULL,
    especialidad character varying(150),
    cargo character varying(100),
    fecha_ingreso date,
    fecha_cese date,
    motivo_cese character varying(200)
);


ALTER TABLE public.personal OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 29177)
-- Name: personal_id_personal_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.personal_id_personal_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.personal_id_personal_seq OWNER TO postgres;

--
-- TOC entry 5719 (class 0 OID 0)
-- Dependencies: 228
-- Name: personal_id_personal_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.personal_id_personal_seq OWNED BY public.personal.id_personal;


--
-- TOC entry 279 (class 1259 OID 29811)
-- Name: pre_tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pre_tickets (
    id_preticket integer NOT NULL,
    id_alumno integer NOT NULL,
    id_concepto integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    estado character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    fecha_emision timestamp without time zone DEFAULT now() NOT NULL,
    fecha_pago timestamp without time zone,
    id_usuario_emite integer,
    CONSTRAINT chk_preticket_estado CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'PAGADO'::character varying, 'ANULADO'::character varying])::text[])))
);


ALTER TABLE public.pre_tickets OWNER TO postgres;

--
-- TOC entry 278 (class 1259 OID 29810)
-- Name: pre_tickets_id_preticket_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pre_tickets_id_preticket_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pre_tickets_id_preticket_seq OWNER TO postgres;

--
-- TOC entry 5720 (class 0 OID 0)
-- Dependencies: 278
-- Name: pre_tickets_id_preticket_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pre_tickets_id_preticket_seq OWNED BY public.pre_tickets.id_preticket;


--
-- TOC entry 227 (class 1259 OID 29155)
-- Name: recuperacion_password; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recuperacion_password (
    id_recuperacion integer NOT NULL,
    id_usuario integer NOT NULL,
    token character varying(255) NOT NULL,
    fecha_solicitud timestamp without time zone DEFAULT now() NOT NULL,
    fecha_expiracion timestamp without time zone NOT NULL,
    usado boolean DEFAULT false NOT NULL
);


ALTER TABLE public.recuperacion_password OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 29154)
-- Name: recuperacion_password_id_recuperacion_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recuperacion_password_id_recuperacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recuperacion_password_id_recuperacion_seq OWNER TO postgres;

--
-- TOC entry 5721 (class 0 OID 0)
-- Dependencies: 226
-- Name: recuperacion_password_id_recuperacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recuperacion_password_id_recuperacion_seq OWNED BY public.recuperacion_password.id_recuperacion;


--
-- TOC entry 261 (class 1259 OID 29555)
-- Name: resumen_asistencia_curso; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resumen_asistencia_curso (
    id_resumen integer NOT NULL,
    id_alumno integer NOT NULL,
    id_curso integer NOT NULL,
    porcentaje_asistencia numeric(5,2) DEFAULT 0,
    total_presente integer DEFAULT 0,
    total_tardanza integer DEFAULT 0,
    total_falta integer DEFAULT 0
);


ALTER TABLE public.resumen_asistencia_curso OWNER TO postgres;

--
-- TOC entry 260 (class 1259 OID 29554)
-- Name: resumen_asistencia_curso_id_resumen_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.resumen_asistencia_curso_id_resumen_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.resumen_asistencia_curso_id_resumen_seq OWNER TO postgres;

--
-- TOC entry 5722 (class 0 OID 0)
-- Dependencies: 260
-- Name: resumen_asistencia_curso_id_resumen_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.resumen_asistencia_curso_id_resumen_seq OWNED BY public.resumen_asistencia_curso.id_resumen;


--
-- TOC entry 223 (class 1259 OID 29105)
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id_rol integer NOT NULL,
    nombre_rol character varying(50) NOT NULL,
    descripcion character varying(200),
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_rol_nombre CHECK (((nombre_rol)::text = ANY ((ARRAY['ADMIN'::character varying, 'DOCENTE'::character varying, 'SECRETARIA'::character varying, 'ESTUDIANTE'::character varying])::text[])))
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- TOC entry 5723 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.roles IS 'Roles del sistema SIGA-UC';


--
-- TOC entry 222 (class 1259 OID 29104)
-- Name: roles_id_rol_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_rol_seq OWNER TO postgres;

--
-- TOC entry 5724 (class 0 OID 0)
-- Dependencies: 222
-- Name: roles_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_rol_seq OWNED BY public.roles.id_rol;


--
-- TOC entry 247 (class 1259 OID 29362)
-- Name: tutores_grado; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tutores_grado (
    id_tutor integer NOT NULL,
    id_grado integer NOT NULL,
    id_personal integer NOT NULL,
    anio_lectivo integer NOT NULL
);


ALTER TABLE public.tutores_grado OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 29361)
-- Name: tutores_grado_id_tutor_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tutores_grado_id_tutor_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tutores_grado_id_tutor_seq OWNER TO postgres;

--
-- TOC entry 5725 (class 0 OID 0)
-- Dependencies: 246
-- Name: tutores_grado_id_tutor_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tutores_grado_id_tutor_seq OWNED BY public.tutores_grado.id_tutor;


--
-- TOC entry 225 (class 1259 OID 29119)
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id_usuario integer NOT NULL,
    dni character(8) NOT NULL,
    nombres character varying(100) NOT NULL,
    apellidos character varying(100) NOT NULL,
    correo_institucional character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    telefono character varying(15),
    id_rol integer NOT NULL,
    estado character varying(20) DEFAULT 'ACTIVO'::character varying NOT NULL,
    requiere_cambio_password boolean DEFAULT false NOT NULL,
    ultimo_login timestamp without time zone,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL,
    fecha_actualizacion timestamp without time zone,
    correo_personal character varying(150),
    CONSTRAINT chk_usuario_dni CHECK ((dni ~ '^[0-9]{8}$'::text)),
    CONSTRAINT chk_usuario_estado CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying, 'CESADO'::character varying])::text[])))
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- TOC entry 5726 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE usuarios; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.usuarios IS 'Usuarios de acceso al sistema (todos los roles)';


--
-- TOC entry 224 (class 1259 OID 29118)
-- Name: usuarios_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_usuario_seq OWNER TO postgres;

--
-- TOC entry 5727 (class 0 OID 0)
-- Dependencies: 224
-- Name: usuarios_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_usuario_seq OWNED BY public.usuarios.id_usuario;


--
-- TOC entry 5154 (class 2604 OID 29700)
-- Name: actas_bimestrales id_acta; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actas_bimestrales ALTER COLUMN id_acta SET DEFAULT nextval('public.actas_bimestrales_id_acta_seq'::regclass);


--
-- TOC entry 5135 (class 2604 OID 29445)
-- Name: alumnos id_alumno; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos ALTER COLUMN id_alumno SET DEFAULT nextval('public.alumnos_id_alumno_seq'::regclass);


--
-- TOC entry 5185 (class 2604 OID 30096)
-- Name: alumnos_riesgo id_riesgo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_riesgo ALTER COLUMN id_riesgo SET DEFAULT nextval('public.alumnos_riesgo_id_riesgo_seq'::regclass);


--
-- TOC entry 5174 (class 2604 OID 29932)
-- Name: aperturas_caja id_apertura; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aperturas_caja ALTER COLUMN id_apertura SET DEFAULT nextval('public.aperturas_caja_id_apertura_seq'::regclass);


--
-- TOC entry 5134 (class 2604 OID 29433)
-- Name: apoderados id_apoderado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apoderados ALTER COLUMN id_apoderado SET DEFAULT nextval('public.apoderados_id_apoderado_seq'::regclass);


--
-- TOC entry 5141 (class 2604 OID 29513)
-- Name: asistencia_alumnos id_asistencia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos ALTER COLUMN id_asistencia SET DEFAULT nextval('public.asistencia_alumnos_id_asistencia_seq'::regclass);


--
-- TOC entry 5118 (class 2604 OID 29198)
-- Name: asistencia_personal id_asistencia_personal; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_personal ALTER COLUMN id_asistencia_personal SET DEFAULT nextval('public.asistencia_personal_id_asistencia_personal_seq'::regclass);


--
-- TOC entry 5159 (class 2604 OID 29762)
-- Name: becas id_beca; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.becas ALTER COLUMN id_beca SET DEFAULT nextval('public.becas_id_beca_seq'::regclass);


--
-- TOC entry 5119 (class 2604 OID 29217)
-- Name: bitacora_auditoria id_bitacora; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bitacora_auditoria ALTER COLUMN id_bitacora SET DEFAULT nextval('public.bitacora_auditoria_id_bitacora_seq'::regclass);


--
-- TOC entry 5170 (class 2604 OID 29890)
-- Name: boletas_electronicas id_boleta; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boletas_electronicas ALTER COLUMN id_boleta SET DEFAULT nextval('public.boletas_electronicas_id_boleta_seq'::regclass);


--
-- TOC entry 5172 (class 2604 OID 29915)
-- Name: cajas id_caja; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cajas ALTER COLUMN id_caja SET DEFAULT nextval('public.cajas_id_caja_seq'::regclass);


--
-- TOC entry 5149 (class 2604 OID 29584)
-- Name: calificaciones id_calificacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones ALTER COLUMN id_calificacion SET DEFAULT nextval('public.calificaciones_id_calificacion_seq'::regclass);


--
-- TOC entry 5130 (class 2604 OID 29335)
-- Name: carga_curricular id_carga; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carga_curricular ALTER COLUMN id_carga SET DEFAULT nextval('public.carga_curricular_id_carga_seq'::regclass);


--
-- TOC entry 5178 (class 2604 OID 29986)
-- Name: cierres_caja id_cierre; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierres_caja ALTER COLUMN id_cierre SET DEFAULT nextval('public.cierres_caja_id_cierre_seq'::regclass);


--
-- TOC entry 5129 (class 2604 OID 29319)
-- Name: competencias id_competencia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias ALTER COLUMN id_competencia SET DEFAULT nextval('public.competencias_id_competencia_seq'::regclass);


--
-- TOC entry 5158 (class 2604 OID 29748)
-- Name: conceptos_pago id_concepto; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conceptos_pago ALTER COLUMN id_concepto SET DEFAULT nextval('public.conceptos_pago_id_concepto_seq'::regclass);


--
-- TOC entry 5153 (class 2604 OID 29668)
-- Name: conclusiones_descriptivas id_conclusion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conclusiones_descriptivas ALTER COLUMN id_conclusion SET DEFAULT nextval('public.conclusiones_descriptivas_id_conclusion_seq'::regclass);


--
-- TOC entry 5124 (class 2604 OID 29267)
-- Name: credenciales_qr id_credencial; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credenciales_qr ALTER COLUMN id_credencial SET DEFAULT nextval('public.credenciales_qr_id_credencial_seq'::regclass);


--
-- TOC entry 5184 (class 2604 OID 30071)
-- Name: cuadro_merito id_cuadro; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadro_merito ALTER COLUMN id_cuadro SET DEFAULT nextval('public.cuadro_merito_id_cuadro_seq'::regclass);


--
-- TOC entry 5128 (class 2604 OID 29307)
-- Name: cursos id_curso; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cursos ALTER COLUMN id_curso SET DEFAULT nextval('public.cursos_id_curso_seq'::regclass);


--
-- TOC entry 5133 (class 2604 OID 29419)
-- Name: escala_calificacion id_escala; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escala_calificacion ALTER COLUMN id_escala SET DEFAULT nextval('public.escala_calificacion_id_escala_seq'::regclass);


--
-- TOC entry 5183 (class 2604 OID 30041)
-- Name: estado_carga_docentes id_estado_carga; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado_carga_docentes ALTER COLUMN id_estado_carga SET DEFAULT nextval('public.estado_carga_docentes_id_estado_carga_seq'::regclass);


--
-- TOC entry 5139 (class 2604 OID 29495)
-- Name: expediente_alumno id_expediente; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expediente_alumno ALTER COLUMN id_expediente SET DEFAULT nextval('public.expediente_alumno_id_expediente_seq'::regclass);


--
-- TOC entry 5181 (class 2604 OID 30018)
-- Name: exportaciones_siagie id_exportacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exportaciones_siagie ALTER COLUMN id_exportacion SET DEFAULT nextval('public.exportaciones_siagie_id_exportacion_seq'::regclass);


--
-- TOC entry 5127 (class 2604 OID 29292)
-- Name: grados id_grado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grados ALTER COLUMN id_grado SET DEFAULT nextval('public.grados_id_grado_seq'::regclass);


--
-- TOC entry 5132 (class 2604 OID 29388)
-- Name: horarios id_horario; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios ALTER COLUMN id_horario SET DEFAULT nextval('public.horarios_id_horario_seq'::regclass);


--
-- TOC entry 5156 (class 2604 OID 29723)
-- Name: libretas id_libreta; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.libretas ALTER COLUMN id_libreta SET DEFAULT nextval('public.libretas_id_libreta_seq'::regclass);


--
-- TOC entry 5176 (class 2604 OID 29956)
-- Name: movimientos_caja id_movimiento; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja ALTER COLUMN id_movimiento SET DEFAULT nextval('public.movimientos_caja_id_movimiento_seq'::regclass);


--
-- TOC entry 5151 (class 2604 OID 29639)
-- Name: notas_finales_area id_nota_final; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_finales_area ALTER COLUMN id_nota_final SET DEFAULT nextval('public.notas_finales_area_id_nota_final_seq'::regclass);


--
-- TOC entry 5121 (class 2604 OID 29239)
-- Name: notificaciones id_notificacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones ALTER COLUMN id_notificacion SET DEFAULT nextval('public.notificaciones_id_notificacion_seq'::regclass);


--
-- TOC entry 5167 (class 2604 OID 29845)
-- Name: pagos id_pago; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos ALTER COLUMN id_pago SET DEFAULT nextval('public.pagos_id_pago_seq'::regclass);


--
-- TOC entry 5161 (class 2604 OID 29783)
-- Name: pensiones id_pension; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pensiones ALTER COLUMN id_pension SET DEFAULT nextval('public.pensiones_id_pension_seq'::regclass);


--
-- TOC entry 5117 (class 2604 OID 29181)
-- Name: personal id_personal; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal ALTER COLUMN id_personal SET DEFAULT nextval('public.personal_id_personal_seq'::regclass);


--
-- TOC entry 5164 (class 2604 OID 29814)
-- Name: pre_tickets id_preticket; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pre_tickets ALTER COLUMN id_preticket SET DEFAULT nextval('public.pre_tickets_id_preticket_seq'::regclass);


--
-- TOC entry 5114 (class 2604 OID 29158)
-- Name: recuperacion_password id_recuperacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recuperacion_password ALTER COLUMN id_recuperacion SET DEFAULT nextval('public.recuperacion_password_id_recuperacion_seq'::regclass);


--
-- TOC entry 5144 (class 2604 OID 29558)
-- Name: resumen_asistencia_curso id_resumen; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumen_asistencia_curso ALTER COLUMN id_resumen SET DEFAULT nextval('public.resumen_asistencia_curso_id_resumen_seq'::regclass);


--
-- TOC entry 5108 (class 2604 OID 29108)
-- Name: roles id_rol; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id_rol SET DEFAULT nextval('public.roles_id_rol_seq'::regclass);


--
-- TOC entry 5131 (class 2604 OID 29365)
-- Name: tutores_grado id_tutor; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tutores_grado ALTER COLUMN id_tutor SET DEFAULT nextval('public.tutores_grado_id_tutor_seq'::regclass);


--
-- TOC entry 5110 (class 2604 OID 29122)
-- Name: usuarios id_usuario; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuarios_id_usuario_seq'::regclass);


--
-- TOC entry 5334 (class 2606 OID 29708)
-- Name: actas_bimestrales actas_bimestrales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actas_bimestrales
    ADD CONSTRAINT actas_bimestrales_pkey PRIMARY KEY (id_acta);


--
-- TOC entry 5293 (class 2606 OID 29471)
-- Name: alumnos alumnos_codigo_estudiante_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_codigo_estudiante_key UNIQUE (codigo_estudiante);


--
-- TOC entry 5295 (class 2606 OID 29469)
-- Name: alumnos alumnos_dni_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_dni_key UNIQUE (dni);


--
-- TOC entry 5297 (class 2606 OID 29467)
-- Name: alumnos alumnos_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_id_usuario_key UNIQUE (id_usuario);


--
-- TOC entry 5299 (class 2606 OID 29465)
-- Name: alumnos alumnos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_pkey PRIMARY KEY (id_alumno);


--
-- TOC entry 5374 (class 2606 OID 30104)
-- Name: alumnos_riesgo alumnos_riesgo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_riesgo
    ADD CONSTRAINT alumnos_riesgo_pkey PRIMARY KEY (id_riesgo);


--
-- TOC entry 5360 (class 2606 OID 29941)
-- Name: aperturas_caja aperturas_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aperturas_caja
    ADD CONSTRAINT aperturas_caja_pkey PRIMARY KEY (id_apertura);


--
-- TOC entry 5289 (class 2606 OID 29440)
-- Name: apoderados apoderados_dni_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apoderados
    ADD CONSTRAINT apoderados_dni_key UNIQUE (dni);


--
-- TOC entry 5291 (class 2606 OID 29438)
-- Name: apoderados apoderados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apoderados
    ADD CONSTRAINT apoderados_pkey PRIMARY KEY (id_apoderado);


--
-- TOC entry 5309 (class 2606 OID 29528)
-- Name: asistencia_alumnos asistencia_alumnos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos
    ADD CONSTRAINT asistencia_alumnos_pkey PRIMARY KEY (id_asistencia);


--
-- TOC entry 5242 (class 2606 OID 29204)
-- Name: asistencia_personal asistencia_personal_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_personal
    ADD CONSTRAINT asistencia_personal_pkey PRIMARY KEY (id_asistencia_personal);


--
-- TOC entry 5342 (class 2606 OID 29773)
-- Name: becas becas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.becas
    ADD CONSTRAINT becas_pkey PRIMARY KEY (id_beca);


--
-- TOC entry 5247 (class 2606 OID 29226)
-- Name: bitacora_auditoria bitacora_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bitacora_auditoria
    ADD CONSTRAINT bitacora_auditoria_pkey PRIMARY KEY (id_bitacora);


--
-- TOC entry 5354 (class 2606 OID 29905)
-- Name: boletas_electronicas boletas_electronicas_numero_boleta_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boletas_electronicas
    ADD CONSTRAINT boletas_electronicas_numero_boleta_key UNIQUE (numero_boleta);


--
-- TOC entry 5356 (class 2606 OID 29903)
-- Name: boletas_electronicas boletas_electronicas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boletas_electronicas
    ADD CONSTRAINT boletas_electronicas_pkey PRIMARY KEY (id_boleta);


--
-- TOC entry 5358 (class 2606 OID 29922)
-- Name: cajas cajas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cajas
    ADD CONSTRAINT cajas_pkey PRIMARY KEY (id_caja);


--
-- TOC entry 5320 (class 2606 OID 29600)
-- Name: calificaciones calificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_pkey PRIMARY KEY (id_calificacion);


--
-- TOC entry 5273 (class 2606 OID 29342)
-- Name: carga_curricular carga_curricular_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carga_curricular
    ADD CONSTRAINT carga_curricular_pkey PRIMARY KEY (id_carga);


--
-- TOC entry 5364 (class 2606 OID 30003)
-- Name: cierres_caja cierres_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierres_caja
    ADD CONSTRAINT cierres_caja_pkey PRIMARY KEY (id_cierre);


--
-- TOC entry 5270 (class 2606 OID 29324)
-- Name: competencias competencias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT competencias_pkey PRIMARY KEY (id_competencia);


--
-- TOC entry 5340 (class 2606 OID 29757)
-- Name: conceptos_pago conceptos_pago_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conceptos_pago
    ADD CONSTRAINT conceptos_pago_pkey PRIMARY KEY (id_concepto);


--
-- TOC entry 5330 (class 2606 OID 29678)
-- Name: conclusiones_descriptivas conclusiones_descriptivas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conclusiones_descriptivas
    ADD CONSTRAINT conclusiones_descriptivas_pkey PRIMARY KEY (id_conclusion);


--
-- TOC entry 5255 (class 2606 OID 29282)
-- Name: credenciales_qr credenciales_qr_codigo_qr_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credenciales_qr
    ADD CONSTRAINT credenciales_qr_codigo_qr_key UNIQUE (codigo_qr);


--
-- TOC entry 5257 (class 2606 OID 29280)
-- Name: credenciales_qr credenciales_qr_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credenciales_qr
    ADD CONSTRAINT credenciales_qr_id_usuario_key UNIQUE (id_usuario);


--
-- TOC entry 5259 (class 2606 OID 29278)
-- Name: credenciales_qr credenciales_qr_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credenciales_qr
    ADD CONSTRAINT credenciales_qr_pkey PRIMARY KEY (id_credencial);


--
-- TOC entry 5370 (class 2606 OID 30079)
-- Name: cuadro_merito cuadro_merito_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadro_merito
    ADD CONSTRAINT cuadro_merito_pkey PRIMARY KEY (id_cuadro);


--
-- TOC entry 5266 (class 2606 OID 29314)
-- Name: cursos cursos_nombre_curso_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cursos
    ADD CONSTRAINT cursos_nombre_curso_key UNIQUE (nombre_curso);


--
-- TOC entry 5268 (class 2606 OID 29312)
-- Name: cursos cursos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cursos
    ADD CONSTRAINT cursos_pkey PRIMARY KEY (id_curso);


--
-- TOC entry 5285 (class 2606 OID 29428)
-- Name: escala_calificacion escala_calificacion_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escala_calificacion
    ADD CONSTRAINT escala_calificacion_codigo_key UNIQUE (codigo);


--
-- TOC entry 5287 (class 2606 OID 29426)
-- Name: escala_calificacion escala_calificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escala_calificacion
    ADD CONSTRAINT escala_calificacion_pkey PRIMARY KEY (id_escala);


--
-- TOC entry 5368 (class 2606 OID 30051)
-- Name: estado_carga_docentes estado_carga_docentes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado_carga_docentes
    ADD CONSTRAINT estado_carga_docentes_pkey PRIMARY KEY (id_estado_carga);


--
-- TOC entry 5305 (class 2606 OID 29503)
-- Name: expediente_alumno expediente_alumno_id_alumno_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expediente_alumno
    ADD CONSTRAINT expediente_alumno_id_alumno_key UNIQUE (id_alumno);


--
-- TOC entry 5307 (class 2606 OID 29501)
-- Name: expediente_alumno expediente_alumno_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expediente_alumno
    ADD CONSTRAINT expediente_alumno_pkey PRIMARY KEY (id_expediente);


--
-- TOC entry 5366 (class 2606 OID 30026)
-- Name: exportaciones_siagie exportaciones_siagie_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exportaciones_siagie
    ADD CONSTRAINT exportaciones_siagie_pkey PRIMARY KEY (id_exportacion);


--
-- TOC entry 5261 (class 2606 OID 29299)
-- Name: grados grados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grados
    ADD CONSTRAINT grados_pkey PRIMARY KEY (id_grado);


--
-- TOC entry 5282 (class 2606 OID 29398)
-- Name: horarios horarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_pkey PRIMARY KEY (id_horario);


--
-- TOC entry 5336 (class 2606 OID 29731)
-- Name: libretas libretas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.libretas
    ADD CONSTRAINT libretas_pkey PRIMARY KEY (id_libreta);


--
-- TOC entry 5362 (class 2606 OID 29966)
-- Name: movimientos_caja movimientos_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_pkey PRIMARY KEY (id_movimiento);


--
-- TOC entry 5326 (class 2606 OID 29651)
-- Name: notas_finales_area notas_finales_area_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_finales_area
    ADD CONSTRAINT notas_finales_area_pkey PRIMARY KEY (id_nota_final);


--
-- TOC entry 5253 (class 2606 OID 29251)
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY (id_notificacion);


--
-- TOC entry 5352 (class 2606 OID 29858)
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id_pago);


--
-- TOC entry 5344 (class 2606 OID 29797)
-- Name: pensiones pensiones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pensiones
    ADD CONSTRAINT pensiones_pkey PRIMARY KEY (id_pension);


--
-- TOC entry 5238 (class 2606 OID 29187)
-- Name: personal personal_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_id_usuario_key UNIQUE (id_usuario);


--
-- TOC entry 5240 (class 2606 OID 29185)
-- Name: personal personal_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_pkey PRIMARY KEY (id_personal);


--
-- TOC entry 5348 (class 2606 OID 29825)
-- Name: pre_tickets pre_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pre_tickets
    ADD CONSTRAINT pre_tickets_pkey PRIMARY KEY (id_preticket);


--
-- TOC entry 5233 (class 2606 OID 29168)
-- Name: recuperacion_password recuperacion_password_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recuperacion_password
    ADD CONSTRAINT recuperacion_password_pkey PRIMARY KEY (id_recuperacion);


--
-- TOC entry 5235 (class 2606 OID 29170)
-- Name: recuperacion_password recuperacion_password_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recuperacion_password
    ADD CONSTRAINT recuperacion_password_token_key UNIQUE (token);


--
-- TOC entry 5316 (class 2606 OID 29567)
-- Name: resumen_asistencia_curso resumen_asistencia_curso_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumen_asistencia_curso
    ADD CONSTRAINT resumen_asistencia_curso_pkey PRIMARY KEY (id_resumen);


--
-- TOC entry 5219 (class 2606 OID 29117)
-- Name: roles roles_nombre_rol_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_rol_key UNIQUE (nombre_rol);


--
-- TOC entry 5221 (class 2606 OID 29115)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id_rol);


--
-- TOC entry 5278 (class 2606 OID 29371)
-- Name: tutores_grado tutores_grado_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tutores_grado
    ADD CONSTRAINT tutores_grado_pkey PRIMARY KEY (id_tutor);


--
-- TOC entry 5314 (class 2606 OID 29530)
-- Name: asistencia_alumnos uq_asistencia_dia; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos
    ADD CONSTRAINT uq_asistencia_dia UNIQUE (id_alumno, id_curso, fecha);


--
-- TOC entry 5245 (class 2606 OID 29206)
-- Name: asistencia_personal uq_asistencia_personal_dia; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_personal
    ADD CONSTRAINT uq_asistencia_personal_dia UNIQUE (id_personal, fecha);


--
-- TOC entry 5324 (class 2606 OID 29602)
-- Name: calificaciones uq_calificacion; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT uq_calificacion UNIQUE (id_alumno, id_curso, id_competencia, bimestre, anio_lectivo);


--
-- TOC entry 5276 (class 2606 OID 29344)
-- Name: carga_curricular uq_carga_curricular; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carga_curricular
    ADD CONSTRAINT uq_carga_curricular UNIQUE (id_grado, id_curso, anio_lectivo);


--
-- TOC entry 5332 (class 2606 OID 29680)
-- Name: conclusiones_descriptivas uq_conclusion; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conclusiones_descriptivas
    ADD CONSTRAINT uq_conclusion UNIQUE (id_alumno, id_curso, bimestre, anio_lectivo);


--
-- TOC entry 5372 (class 2606 OID 30081)
-- Name: cuadro_merito uq_cuadro; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadro_merito
    ADD CONSTRAINT uq_cuadro UNIQUE (id_alumno, bimestre, anio_lectivo);


--
-- TOC entry 5264 (class 2606 OID 29301)
-- Name: grados uq_grado; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grados
    ADD CONSTRAINT uq_grado UNIQUE (nombre_grado, seccion, anio_lectivo);


--
-- TOC entry 5338 (class 2606 OID 29733)
-- Name: libretas uq_libreta; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.libretas
    ADD CONSTRAINT uq_libreta UNIQUE (id_alumno, bimestre, anio_lectivo);


--
-- TOC entry 5328 (class 2606 OID 29653)
-- Name: notas_finales_area uq_nota_final; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_finales_area
    ADD CONSTRAINT uq_nota_final UNIQUE (id_alumno, id_curso, bimestre, anio_lectivo);


--
-- TOC entry 5346 (class 2606 OID 29799)
-- Name: pensiones uq_pension; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pensiones
    ADD CONSTRAINT uq_pension UNIQUE (id_alumno, anio_lectivo, mes);


--
-- TOC entry 5318 (class 2606 OID 29569)
-- Name: resumen_asistencia_curso uq_resumen; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumen_asistencia_curso
    ADD CONSTRAINT uq_resumen UNIQUE (id_alumno, id_curso);


--
-- TOC entry 5376 (class 2606 OID 30106)
-- Name: alumnos_riesgo uq_riesgo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_riesgo
    ADD CONSTRAINT uq_riesgo UNIQUE (id_alumno, bimestre);


--
-- TOC entry 5280 (class 2606 OID 29373)
-- Name: tutores_grado uq_tutor_grado; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tutores_grado
    ADD CONSTRAINT uq_tutor_grado UNIQUE (id_grado, anio_lectivo);


--
-- TOC entry 5226 (class 2606 OID 29145)
-- Name: usuarios usuarios_correo_institucional_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_correo_institucional_key UNIQUE (correo_institucional);


--
-- TOC entry 5228 (class 2606 OID 29143)
-- Name: usuarios usuarios_dni_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_dni_key UNIQUE (dni);


--
-- TOC entry 5230 (class 2606 OID 29141)
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario);


--
-- TOC entry 5300 (class 1259 OID 29490)
-- Name: idx_alumnos_anio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alumnos_anio ON public.alumnos USING btree (anio_lectivo);


--
-- TOC entry 5301 (class 1259 OID 29487)
-- Name: idx_alumnos_dni; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alumnos_dni ON public.alumnos USING btree (dni);


--
-- TOC entry 5302 (class 1259 OID 29489)
-- Name: idx_alumnos_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alumnos_estado ON public.alumnos USING btree (estado_matricula);


--
-- TOC entry 5303 (class 1259 OID 29488)
-- Name: idx_alumnos_grado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alumnos_grado ON public.alumnos USING btree (id_grado);


--
-- TOC entry 5310 (class 1259 OID 29551)
-- Name: idx_asistencia_alumno; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencia_alumno ON public.asistencia_alumnos USING btree (id_alumno);


--
-- TOC entry 5311 (class 1259 OID 29553)
-- Name: idx_asistencia_curso; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencia_curso ON public.asistencia_alumnos USING btree (id_curso, fecha);


--
-- TOC entry 5312 (class 1259 OID 29552)
-- Name: idx_asistencia_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencia_fecha ON public.asistencia_alumnos USING btree (fecha);


--
-- TOC entry 5243 (class 1259 OID 29212)
-- Name: idx_asistencia_personal_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencia_personal_fecha ON public.asistencia_personal USING btree (fecha);


--
-- TOC entry 5248 (class 1259 OID 29232)
-- Name: idx_bitacora_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bitacora_fecha ON public.bitacora_auditoria USING btree (fecha_hora);


--
-- TOC entry 5249 (class 1259 OID 29234)
-- Name: idx_bitacora_modulo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bitacora_modulo ON public.bitacora_auditoria USING btree (modulo_afectado);


--
-- TOC entry 5250 (class 1259 OID 29233)
-- Name: idx_bitacora_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bitacora_usuario ON public.bitacora_auditoria USING btree (id_usuario);


--
-- TOC entry 5321 (class 1259 OID 29633)
-- Name: idx_calif_alumno_curso; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calif_alumno_curso ON public.calificaciones USING btree (id_alumno, id_curso);


--
-- TOC entry 5322 (class 1259 OID 29634)
-- Name: idx_calif_bimestre; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calif_bimestre ON public.calificaciones USING btree (bimestre, anio_lectivo);


--
-- TOC entry 5274 (class 1259 OID 29360)
-- Name: idx_carga_docente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carga_docente ON public.carga_curricular USING btree (id_personal);


--
-- TOC entry 5271 (class 1259 OID 29330)
-- Name: idx_competencias_curso; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_competencias_curso ON public.competencias USING btree (id_curso);


--
-- TOC entry 5262 (class 1259 OID 29302)
-- Name: idx_grados_anio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grados_anio ON public.grados USING btree (anio_lectivo);


--
-- TOC entry 5283 (class 1259 OID 29414)
-- Name: idx_horario_grado_dia; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_horario_grado_dia ON public.horarios USING btree (id_grado, dia_semana);


--
-- TOC entry 5251 (class 1259 OID 29262)
-- Name: idx_notif_destino; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_destino ON public.notificaciones USING btree (id_usuario_destino, leido);


--
-- TOC entry 5349 (class 1259 OID 29884)
-- Name: idx_pagos_alumno; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pagos_alumno ON public.pagos USING btree (id_alumno);


--
-- TOC entry 5350 (class 1259 OID 29885)
-- Name: idx_pagos_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pagos_fecha ON public.pagos USING btree (fecha_pago);


--
-- TOC entry 5236 (class 1259 OID 29193)
-- Name: idx_personal_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personal_usuario ON public.personal USING btree (id_usuario);


--
-- TOC entry 5231 (class 1259 OID 29176)
-- Name: idx_recuperacion_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recuperacion_token ON public.recuperacion_password USING btree (token);


--
-- TOC entry 5222 (class 1259 OID 29152)
-- Name: idx_usuarios_correo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_correo ON public.usuarios USING btree (correo_institucional);


--
-- TOC entry 5223 (class 1259 OID 29151)
-- Name: idx_usuarios_dni; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_dni ON public.usuarios USING btree (dni);


--
-- TOC entry 5224 (class 1259 OID 29153)
-- Name: idx_usuarios_rol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_rol ON public.usuarios USING btree (id_rol);


--
-- TOC entry 5450 (class 2620 OID 30125)
-- Name: calificaciones trg_calificaciones_audit; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_calificaciones_audit AFTER INSERT OR UPDATE ON public.calificaciones FOR EACH ROW EXECUTE FUNCTION public.trg_auditar_calificacion();


--
-- TOC entry 5451 (class 2620 OID 30131)
-- Name: pagos trg_pagos_mov_caja; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_pagos_mov_caja AFTER INSERT ON public.pagos FOR EACH ROW EXECUTE FUNCTION public.trg_pago_a_caja();


--
-- TOC entry 5452 (class 2620 OID 30129)
-- Name: pagos trg_pagos_pension; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_pagos_pension AFTER INSERT ON public.pagos FOR EACH ROW EXECUTE FUNCTION public.trg_actualizar_pension();


--
-- TOC entry 5453 (class 2620 OID 30127)
-- Name: pagos trg_pagos_preticket; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_pagos_preticket AFTER INSERT ON public.pagos FOR EACH ROW EXECUTE FUNCTION public.trg_actualizar_preticket();


--
-- TOC entry 5449 (class 2620 OID 30123)
-- Name: usuarios trg_usuarios_actualizar; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_usuarios_actualizar BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.trg_actualizar_timestamp();


--
-- TOC entry 5415 (class 2606 OID 29714)
-- Name: actas_bimestrales actas_bimestrales_cerrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actas_bimestrales
    ADD CONSTRAINT actas_bimestrales_cerrado_por_fkey FOREIGN KEY (cerrado_por) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- TOC entry 5416 (class 2606 OID 29709)
-- Name: actas_bimestrales actas_bimestrales_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actas_bimestrales
    ADD CONSTRAINT actas_bimestrales_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- TOC entry 5394 (class 2606 OID 29477)
-- Name: alumnos alumnos_id_apoderado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_id_apoderado_fkey FOREIGN KEY (id_apoderado) REFERENCES public.apoderados(id_apoderado) ON DELETE SET NULL;


--
-- TOC entry 5395 (class 2606 OID 29482)
-- Name: alumnos alumnos_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE SET NULL;


--
-- TOC entry 5396 (class 2606 OID 29472)
-- Name: alumnos alumnos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- TOC entry 5446 (class 2606 OID 30107)
-- Name: alumnos_riesgo alumnos_riesgo_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_riesgo
    ADD CONSTRAINT alumnos_riesgo_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5447 (class 2606 OID 30112)
-- Name: alumnos_riesgo alumnos_riesgo_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_riesgo
    ADD CONSTRAINT alumnos_riesgo_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- TOC entry 5448 (class 2606 OID 30117)
-- Name: alumnos_riesgo alumnos_riesgo_id_tutor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_riesgo
    ADD CONSTRAINT alumnos_riesgo_id_tutor_fkey FOREIGN KEY (id_tutor) REFERENCES public.personal(id_personal) ON DELETE SET NULL;


--
-- TOC entry 5432 (class 2606 OID 29942)
-- Name: aperturas_caja aperturas_caja_id_caja_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aperturas_caja
    ADD CONSTRAINT aperturas_caja_id_caja_fkey FOREIGN KEY (id_caja) REFERENCES public.cajas(id_caja) ON DELETE CASCADE;


--
-- TOC entry 5433 (class 2606 OID 29947)
-- Name: aperturas_caja aperturas_caja_id_usuario_apertura_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aperturas_caja
    ADD CONSTRAINT aperturas_caja_id_usuario_apertura_fkey FOREIGN KEY (id_usuario_apertura) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- TOC entry 5398 (class 2606 OID 29531)
-- Name: asistencia_alumnos asistencia_alumnos_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos
    ADD CONSTRAINT asistencia_alumnos_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5399 (class 2606 OID 29536)
-- Name: asistencia_alumnos asistencia_alumnos_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos
    ADD CONSTRAINT asistencia_alumnos_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- TOC entry 5400 (class 2606 OID 29546)
-- Name: asistencia_alumnos asistencia_alumnos_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos
    ADD CONSTRAINT asistencia_alumnos_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- TOC entry 5401 (class 2606 OID 29541)
-- Name: asistencia_alumnos asistencia_alumnos_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos
    ADD CONSTRAINT asistencia_alumnos_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE SET NULL;


--
-- TOC entry 5380 (class 2606 OID 29207)
-- Name: asistencia_personal asistencia_personal_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_personal
    ADD CONSTRAINT asistencia_personal_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE CASCADE;


--
-- TOC entry 5419 (class 2606 OID 29774)
-- Name: becas becas_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.becas
    ADD CONSTRAINT becas_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5381 (class 2606 OID 29227)
-- Name: bitacora_auditoria bitacora_auditoria_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bitacora_auditoria
    ADD CONSTRAINT bitacora_auditoria_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- TOC entry 5430 (class 2606 OID 29906)
-- Name: boletas_electronicas boletas_electronicas_id_pago_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boletas_electronicas
    ADD CONSTRAINT boletas_electronicas_id_pago_fkey FOREIGN KEY (id_pago) REFERENCES public.pagos(id_pago) ON DELETE CASCADE;


--
-- TOC entry 5431 (class 2606 OID 29923)
-- Name: cajas cajas_responsable_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cajas
    ADD CONSTRAINT cajas_responsable_fkey FOREIGN KEY (responsable) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- TOC entry 5404 (class 2606 OID 29603)
-- Name: calificaciones calificaciones_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5405 (class 2606 OID 29613)
-- Name: calificaciones calificaciones_id_competencia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_id_competencia_fkey FOREIGN KEY (id_competencia) REFERENCES public.competencias(id_competencia) ON DELETE CASCADE;


--
-- TOC entry 5406 (class 2606 OID 29608)
-- Name: calificaciones calificaciones_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- TOC entry 5407 (class 2606 OID 29623)
-- Name: calificaciones calificaciones_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- TOC entry 5408 (class 2606 OID 29618)
-- Name: calificaciones calificaciones_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE SET NULL;


--
-- TOC entry 5409 (class 2606 OID 29628)
-- Name: calificaciones calificaciones_modificado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_modificado_por_fkey FOREIGN KEY (modificado_por) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- TOC entry 5386 (class 2606 OID 29350)
-- Name: carga_curricular carga_curricular_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carga_curricular
    ADD CONSTRAINT carga_curricular_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- TOC entry 5387 (class 2606 OID 29345)
-- Name: carga_curricular carga_curricular_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carga_curricular
    ADD CONSTRAINT carga_curricular_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- TOC entry 5388 (class 2606 OID 29355)
-- Name: carga_curricular carga_curricular_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carga_curricular
    ADD CONSTRAINT carga_curricular_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE CASCADE;


--
-- TOC entry 5437 (class 2606 OID 30004)
-- Name: cierres_caja cierres_caja_id_apertura_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierres_caja
    ADD CONSTRAINT cierres_caja_id_apertura_fkey FOREIGN KEY (id_apertura) REFERENCES public.aperturas_caja(id_apertura) ON DELETE CASCADE;


--
-- TOC entry 5438 (class 2606 OID 30009)
-- Name: cierres_caja cierres_caja_id_usuario_cierre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierres_caja
    ADD CONSTRAINT cierres_caja_id_usuario_cierre_fkey FOREIGN KEY (id_usuario_cierre) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- TOC entry 5385 (class 2606 OID 29325)
-- Name: competencias competencias_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT competencias_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- TOC entry 5412 (class 2606 OID 29681)
-- Name: conclusiones_descriptivas conclusiones_descriptivas_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conclusiones_descriptivas
    ADD CONSTRAINT conclusiones_descriptivas_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5413 (class 2606 OID 29686)
-- Name: conclusiones_descriptivas conclusiones_descriptivas_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conclusiones_descriptivas
    ADD CONSTRAINT conclusiones_descriptivas_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- TOC entry 5414 (class 2606 OID 29691)
-- Name: conclusiones_descriptivas conclusiones_descriptivas_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conclusiones_descriptivas
    ADD CONSTRAINT conclusiones_descriptivas_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE SET NULL;


--
-- TOC entry 5384 (class 2606 OID 29283)
-- Name: credenciales_qr credenciales_qr_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credenciales_qr
    ADD CONSTRAINT credenciales_qr_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- TOC entry 5444 (class 2606 OID 30082)
-- Name: cuadro_merito cuadro_merito_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadro_merito
    ADD CONSTRAINT cuadro_merito_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5445 (class 2606 OID 30087)
-- Name: cuadro_merito cuadro_merito_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadro_merito
    ADD CONSTRAINT cuadro_merito_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- TOC entry 5441 (class 2606 OID 30057)
-- Name: estado_carga_docentes estado_carga_docentes_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado_carga_docentes
    ADD CONSTRAINT estado_carga_docentes_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- TOC entry 5442 (class 2606 OID 30062)
-- Name: estado_carga_docentes estado_carga_docentes_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado_carga_docentes
    ADD CONSTRAINT estado_carga_docentes_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- TOC entry 5443 (class 2606 OID 30052)
-- Name: estado_carga_docentes estado_carga_docentes_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado_carga_docentes
    ADD CONSTRAINT estado_carga_docentes_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE CASCADE;


--
-- TOC entry 5397 (class 2606 OID 29504)
-- Name: expediente_alumno expediente_alumno_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expediente_alumno
    ADD CONSTRAINT expediente_alumno_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5439 (class 2606 OID 30027)
-- Name: exportaciones_siagie exportaciones_siagie_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exportaciones_siagie
    ADD CONSTRAINT exportaciones_siagie_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- TOC entry 5440 (class 2606 OID 30032)
-- Name: exportaciones_siagie exportaciones_siagie_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exportaciones_siagie
    ADD CONSTRAINT exportaciones_siagie_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- TOC entry 5391 (class 2606 OID 29404)
-- Name: horarios horarios_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE SET NULL;


--
-- TOC entry 5392 (class 2606 OID 29399)
-- Name: horarios horarios_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- TOC entry 5393 (class 2606 OID 29409)
-- Name: horarios horarios_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE SET NULL;


--
-- TOC entry 5417 (class 2606 OID 29734)
-- Name: libretas libretas_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.libretas
    ADD CONSTRAINT libretas_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5418 (class 2606 OID 29739)
-- Name: libretas libretas_id_tutor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.libretas
    ADD CONSTRAINT libretas_id_tutor_fkey FOREIGN KEY (id_tutor) REFERENCES public.personal(id_personal) ON DELETE SET NULL;


--
-- TOC entry 5434 (class 2606 OID 29967)
-- Name: movimientos_caja movimientos_caja_id_apertura_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_id_apertura_fkey FOREIGN KEY (id_apertura) REFERENCES public.aperturas_caja(id_apertura) ON DELETE CASCADE;


--
-- TOC entry 5435 (class 2606 OID 29972)
-- Name: movimientos_caja movimientos_caja_id_pago_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_id_pago_fkey FOREIGN KEY (id_pago) REFERENCES public.pagos(id_pago) ON DELETE SET NULL;


--
-- TOC entry 5436 (class 2606 OID 29977)
-- Name: movimientos_caja movimientos_caja_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- TOC entry 5410 (class 2606 OID 29654)
-- Name: notas_finales_area notas_finales_area_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_finales_area
    ADD CONSTRAINT notas_finales_area_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5411 (class 2606 OID 29659)
-- Name: notas_finales_area notas_finales_area_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_finales_area
    ADD CONSTRAINT notas_finales_area_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- TOC entry 5382 (class 2606 OID 29252)
-- Name: notificaciones notificaciones_id_usuario_destino_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_id_usuario_destino_fkey FOREIGN KEY (id_usuario_destino) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- TOC entry 5383 (class 2606 OID 29257)
-- Name: notificaciones notificaciones_id_usuario_remitente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_id_usuario_remitente_fkey FOREIGN KEY (id_usuario_remitente) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- TOC entry 5425 (class 2606 OID 29859)
-- Name: pagos pagos_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5426 (class 2606 OID 29874)
-- Name: pagos pagos_id_concepto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_concepto_fkey FOREIGN KEY (id_concepto) REFERENCES public.conceptos_pago(id_concepto) ON DELETE CASCADE;


--
-- TOC entry 5427 (class 2606 OID 29869)
-- Name: pagos pagos_id_pension_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_pension_fkey FOREIGN KEY (id_pension) REFERENCES public.pensiones(id_pension) ON DELETE SET NULL;


--
-- TOC entry 5428 (class 2606 OID 29864)
-- Name: pagos pagos_id_preticket_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_preticket_fkey FOREIGN KEY (id_preticket) REFERENCES public.pre_tickets(id_preticket) ON DELETE SET NULL;


--
-- TOC entry 5429 (class 2606 OID 29879)
-- Name: pagos pagos_id_usuario_cobrador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_usuario_cobrador_fkey FOREIGN KEY (id_usuario_cobrador) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- TOC entry 5420 (class 2606 OID 29800)
-- Name: pensiones pensiones_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pensiones
    ADD CONSTRAINT pensiones_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5421 (class 2606 OID 29805)
-- Name: pensiones pensiones_id_beca_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pensiones
    ADD CONSTRAINT pensiones_id_beca_fkey FOREIGN KEY (id_beca) REFERENCES public.becas(id_beca) ON DELETE SET NULL;


--
-- TOC entry 5379 (class 2606 OID 29188)
-- Name: personal personal_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- TOC entry 5422 (class 2606 OID 29826)
-- Name: pre_tickets pre_tickets_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pre_tickets
    ADD CONSTRAINT pre_tickets_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5423 (class 2606 OID 29831)
-- Name: pre_tickets pre_tickets_id_concepto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pre_tickets
    ADD CONSTRAINT pre_tickets_id_concepto_fkey FOREIGN KEY (id_concepto) REFERENCES public.conceptos_pago(id_concepto) ON DELETE CASCADE;


--
-- TOC entry 5424 (class 2606 OID 29836)
-- Name: pre_tickets pre_tickets_id_usuario_emite_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pre_tickets
    ADD CONSTRAINT pre_tickets_id_usuario_emite_fkey FOREIGN KEY (id_usuario_emite) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- TOC entry 5378 (class 2606 OID 29171)
-- Name: recuperacion_password recuperacion_password_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recuperacion_password
    ADD CONSTRAINT recuperacion_password_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- TOC entry 5402 (class 2606 OID 29570)
-- Name: resumen_asistencia_curso resumen_asistencia_curso_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumen_asistencia_curso
    ADD CONSTRAINT resumen_asistencia_curso_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- TOC entry 5403 (class 2606 OID 29575)
-- Name: resumen_asistencia_curso resumen_asistencia_curso_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumen_asistencia_curso
    ADD CONSTRAINT resumen_asistencia_curso_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- TOC entry 5389 (class 2606 OID 29374)
-- Name: tutores_grado tutores_grado_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tutores_grado
    ADD CONSTRAINT tutores_grado_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- TOC entry 5390 (class 2606 OID 29379)
-- Name: tutores_grado tutores_grado_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tutores_grado
    ADD CONSTRAINT tutores_grado_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE CASCADE;


--
-- TOC entry 5377 (class 2606 OID 29146)
-- Name: usuarios usuarios_id_rol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.roles(id_rol) ON UPDATE CASCADE;


-- Completed on 2026-10-13 16:05:00

--
-- PostgreSQL database dump complete
--

\unrestrict hBDz7fjlo2QAtY8Rgv4d10e7YDzFP8IeUQrCN0gvcSblnLhKNlDgkCsPtpfUtpr

