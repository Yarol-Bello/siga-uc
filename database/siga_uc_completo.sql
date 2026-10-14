--
-- PostgreSQL database dump
--

\restrict H2pgqSdeNQDJT6NpujBv97p4exn4khVaki89wHtGzEkalfL4fDjh0v0yDXHuSPm

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

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
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
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
-- Name: actas_bimestrales_id_acta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.actas_bimestrales_id_acta_seq OWNED BY public.actas_bimestrales.id_acta;


--
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
-- Name: alumnos_id_alumno_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alumnos_id_alumno_seq OWNED BY public.alumnos.id_alumno;


--
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
-- Name: alumnos_riesgo_id_riesgo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alumnos_riesgo_id_riesgo_seq OWNED BY public.alumnos_riesgo.id_riesgo;


--
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
-- Name: aperturas_caja_id_apertura_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.aperturas_caja_id_apertura_seq OWNED BY public.aperturas_caja.id_apertura;


--
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
-- Name: apoderados_id_apoderado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.apoderados_id_apoderado_seq OWNED BY public.apoderados.id_apoderado;


--
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
-- Name: asistencia_alumnos_id_asistencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asistencia_alumnos_id_asistencia_seq OWNED BY public.asistencia_alumnos.id_asistencia;


--
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
-- Name: asistencia_personal_id_asistencia_personal_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asistencia_personal_id_asistencia_personal_seq OWNED BY public.asistencia_personal.id_asistencia_personal;


--
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
-- Name: becas_id_beca_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.becas_id_beca_seq OWNED BY public.becas.id_beca;


--
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
-- Name: bitacora_auditoria_id_bitacora_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bitacora_auditoria_id_bitacora_seq OWNED BY public.bitacora_auditoria.id_bitacora;


--
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
-- Name: boletas_electronicas_id_boleta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.boletas_electronicas_id_boleta_seq OWNED BY public.boletas_electronicas.id_boleta;


--
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
-- Name: cajas_id_caja_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cajas_id_caja_seq OWNED BY public.cajas.id_caja;


--
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
-- Name: calificaciones_id_calificacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.calificaciones_id_calificacion_seq OWNED BY public.calificaciones.id_calificacion;


--
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
-- Name: carga_curricular_id_carga_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.carga_curricular_id_carga_seq OWNED BY public.carga_curricular.id_carga;


--
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
-- Name: cierres_caja_id_cierre_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cierres_caja_id_cierre_seq OWNED BY public.cierres_caja.id_cierre;


--
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
-- Name: competencias_id_competencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.competencias_id_competencia_seq OWNED BY public.competencias.id_competencia;


--
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
-- Name: conceptos_pago_id_concepto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conceptos_pago_id_concepto_seq OWNED BY public.conceptos_pago.id_concepto;


--
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
-- Name: conclusiones_descriptivas_id_conclusion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conclusiones_descriptivas_id_conclusion_seq OWNED BY public.conclusiones_descriptivas.id_conclusion;


--
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
-- Name: credenciales_qr_id_credencial_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.credenciales_qr_id_credencial_seq OWNED BY public.credenciales_qr.id_credencial;


--
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
-- Name: cuadro_merito_id_cuadro_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cuadro_merito_id_cuadro_seq OWNED BY public.cuadro_merito.id_cuadro;


--
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
-- Name: cursos_id_curso_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cursos_id_curso_seq OWNED BY public.cursos.id_curso;


--
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
-- Name: escala_calificacion_id_escala_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.escala_calificacion_id_escala_seq OWNED BY public.escala_calificacion.id_escala;


--
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
-- Name: estado_carga_docentes_id_estado_carga_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.estado_carga_docentes_id_estado_carga_seq OWNED BY public.estado_carga_docentes.id_estado_carga;


--
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
-- Name: expediente_alumno_id_expediente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.expediente_alumno_id_expediente_seq OWNED BY public.expediente_alumno.id_expediente;


--
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
-- Name: exportaciones_siagie_id_exportacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exportaciones_siagie_id_exportacion_seq OWNED BY public.exportaciones_siagie.id_exportacion;


--
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
-- Name: grados_id_grado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grados_id_grado_seq OWNED BY public.grados.id_grado;


--
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
-- Name: horarios_id_horario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.horarios_id_horario_seq OWNED BY public.horarios.id_horario;


--
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
-- Name: libretas_id_libreta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.libretas_id_libreta_seq OWNED BY public.libretas.id_libreta;


--
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
-- Name: movimientos_caja_id_movimiento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.movimientos_caja_id_movimiento_seq OWNED BY public.movimientos_caja.id_movimiento;


--
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
-- Name: notas_finales_area_id_nota_final_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notas_finales_area_id_nota_final_seq OWNED BY public.notas_finales_area.id_nota_final;


--
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
-- Name: notificaciones_id_notificacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notificaciones_id_notificacion_seq OWNED BY public.notificaciones.id_notificacion;


--
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
-- Name: pagos_id_pago_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pagos_id_pago_seq OWNED BY public.pagos.id_pago;


--
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
-- Name: pensiones_id_pension_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pensiones_id_pension_seq OWNED BY public.pensiones.id_pension;


--
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
-- Name: personal_id_personal_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.personal_id_personal_seq OWNED BY public.personal.id_personal;


--
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
-- Name: pre_tickets_id_preticket_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pre_tickets_id_preticket_seq OWNED BY public.pre_tickets.id_preticket;


--
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
-- Name: recuperacion_password_id_recuperacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recuperacion_password_id_recuperacion_seq OWNED BY public.recuperacion_password.id_recuperacion;


--
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
-- Name: resumen_asistencia_curso_id_resumen_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.resumen_asistencia_curso_id_resumen_seq OWNED BY public.resumen_asistencia_curso.id_resumen;


--
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
-- Name: TABLE roles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.roles IS 'Roles del sistema SIGA-UC';


--
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
-- Name: roles_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_rol_seq OWNED BY public.roles.id_rol;


--
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
-- Name: tutores_grado_id_tutor_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tutores_grado_id_tutor_seq OWNED BY public.tutores_grado.id_tutor;


--
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
-- Name: TABLE usuarios; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.usuarios IS 'Usuarios de acceso al sistema (todos los roles)';


--
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
-- Name: usuarios_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_usuario_seq OWNED BY public.usuarios.id_usuario;


--
-- Name: actas_bimestrales id_acta; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actas_bimestrales ALTER COLUMN id_acta SET DEFAULT nextval('public.actas_bimestrales_id_acta_seq'::regclass);


--
-- Name: alumnos id_alumno; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos ALTER COLUMN id_alumno SET DEFAULT nextval('public.alumnos_id_alumno_seq'::regclass);


--
-- Name: alumnos_riesgo id_riesgo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_riesgo ALTER COLUMN id_riesgo SET DEFAULT nextval('public.alumnos_riesgo_id_riesgo_seq'::regclass);


--
-- Name: aperturas_caja id_apertura; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aperturas_caja ALTER COLUMN id_apertura SET DEFAULT nextval('public.aperturas_caja_id_apertura_seq'::regclass);


--
-- Name: apoderados id_apoderado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apoderados ALTER COLUMN id_apoderado SET DEFAULT nextval('public.apoderados_id_apoderado_seq'::regclass);


--
-- Name: asistencia_alumnos id_asistencia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos ALTER COLUMN id_asistencia SET DEFAULT nextval('public.asistencia_alumnos_id_asistencia_seq'::regclass);


--
-- Name: asistencia_personal id_asistencia_personal; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_personal ALTER COLUMN id_asistencia_personal SET DEFAULT nextval('public.asistencia_personal_id_asistencia_personal_seq'::regclass);


--
-- Name: becas id_beca; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.becas ALTER COLUMN id_beca SET DEFAULT nextval('public.becas_id_beca_seq'::regclass);


--
-- Name: bitacora_auditoria id_bitacora; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bitacora_auditoria ALTER COLUMN id_bitacora SET DEFAULT nextval('public.bitacora_auditoria_id_bitacora_seq'::regclass);


--
-- Name: boletas_electronicas id_boleta; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boletas_electronicas ALTER COLUMN id_boleta SET DEFAULT nextval('public.boletas_electronicas_id_boleta_seq'::regclass);


--
-- Name: cajas id_caja; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cajas ALTER COLUMN id_caja SET DEFAULT nextval('public.cajas_id_caja_seq'::regclass);


--
-- Name: calificaciones id_calificacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones ALTER COLUMN id_calificacion SET DEFAULT nextval('public.calificaciones_id_calificacion_seq'::regclass);


--
-- Name: carga_curricular id_carga; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carga_curricular ALTER COLUMN id_carga SET DEFAULT nextval('public.carga_curricular_id_carga_seq'::regclass);


--
-- Name: cierres_caja id_cierre; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierres_caja ALTER COLUMN id_cierre SET DEFAULT nextval('public.cierres_caja_id_cierre_seq'::regclass);


--
-- Name: competencias id_competencia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias ALTER COLUMN id_competencia SET DEFAULT nextval('public.competencias_id_competencia_seq'::regclass);


--
-- Name: conceptos_pago id_concepto; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conceptos_pago ALTER COLUMN id_concepto SET DEFAULT nextval('public.conceptos_pago_id_concepto_seq'::regclass);


--
-- Name: conclusiones_descriptivas id_conclusion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conclusiones_descriptivas ALTER COLUMN id_conclusion SET DEFAULT nextval('public.conclusiones_descriptivas_id_conclusion_seq'::regclass);


--
-- Name: credenciales_qr id_credencial; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credenciales_qr ALTER COLUMN id_credencial SET DEFAULT nextval('public.credenciales_qr_id_credencial_seq'::regclass);


--
-- Name: cuadro_merito id_cuadro; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadro_merito ALTER COLUMN id_cuadro SET DEFAULT nextval('public.cuadro_merito_id_cuadro_seq'::regclass);


--
-- Name: cursos id_curso; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cursos ALTER COLUMN id_curso SET DEFAULT nextval('public.cursos_id_curso_seq'::regclass);


--
-- Name: escala_calificacion id_escala; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escala_calificacion ALTER COLUMN id_escala SET DEFAULT nextval('public.escala_calificacion_id_escala_seq'::regclass);


--
-- Name: estado_carga_docentes id_estado_carga; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado_carga_docentes ALTER COLUMN id_estado_carga SET DEFAULT nextval('public.estado_carga_docentes_id_estado_carga_seq'::regclass);


--
-- Name: expediente_alumno id_expediente; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expediente_alumno ALTER COLUMN id_expediente SET DEFAULT nextval('public.expediente_alumno_id_expediente_seq'::regclass);


--
-- Name: exportaciones_siagie id_exportacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exportaciones_siagie ALTER COLUMN id_exportacion SET DEFAULT nextval('public.exportaciones_siagie_id_exportacion_seq'::regclass);


--
-- Name: grados id_grado; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grados ALTER COLUMN id_grado SET DEFAULT nextval('public.grados_id_grado_seq'::regclass);


--
-- Name: horarios id_horario; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios ALTER COLUMN id_horario SET DEFAULT nextval('public.horarios_id_horario_seq'::regclass);


--
-- Name: libretas id_libreta; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.libretas ALTER COLUMN id_libreta SET DEFAULT nextval('public.libretas_id_libreta_seq'::regclass);


--
-- Name: movimientos_caja id_movimiento; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja ALTER COLUMN id_movimiento SET DEFAULT nextval('public.movimientos_caja_id_movimiento_seq'::regclass);


--
-- Name: notas_finales_area id_nota_final; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_finales_area ALTER COLUMN id_nota_final SET DEFAULT nextval('public.notas_finales_area_id_nota_final_seq'::regclass);


--
-- Name: notificaciones id_notificacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones ALTER COLUMN id_notificacion SET DEFAULT nextval('public.notificaciones_id_notificacion_seq'::regclass);


--
-- Name: pagos id_pago; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos ALTER COLUMN id_pago SET DEFAULT nextval('public.pagos_id_pago_seq'::regclass);


--
-- Name: pensiones id_pension; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pensiones ALTER COLUMN id_pension SET DEFAULT nextval('public.pensiones_id_pension_seq'::regclass);


--
-- Name: personal id_personal; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal ALTER COLUMN id_personal SET DEFAULT nextval('public.personal_id_personal_seq'::regclass);


--
-- Name: pre_tickets id_preticket; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pre_tickets ALTER COLUMN id_preticket SET DEFAULT nextval('public.pre_tickets_id_preticket_seq'::regclass);


--
-- Name: recuperacion_password id_recuperacion; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recuperacion_password ALTER COLUMN id_recuperacion SET DEFAULT nextval('public.recuperacion_password_id_recuperacion_seq'::regclass);


--
-- Name: resumen_asistencia_curso id_resumen; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumen_asistencia_curso ALTER COLUMN id_resumen SET DEFAULT nextval('public.resumen_asistencia_curso_id_resumen_seq'::regclass);


--
-- Name: roles id_rol; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id_rol SET DEFAULT nextval('public.roles_id_rol_seq'::regclass);


--
-- Name: tutores_grado id_tutor; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tutores_grado ALTER COLUMN id_tutor SET DEFAULT nextval('public.tutores_grado_id_tutor_seq'::regclass);


--
-- Name: usuarios id_usuario; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuarios_id_usuario_seq'::regclass);


--
-- Data for Name: actas_bimestrales; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.actas_bimestrales (id_acta, periodo, anio_lectivo, id_grado, estado, fecha_cierre, cerrado_por, hash_integridad) VALUES (1, '1er Bimestre', 2026, NULL, 'CERRADO', '2026-05-15 18:00:00', 1, NULL);
INSERT INTO public.actas_bimestrales (id_acta, periodo, anio_lectivo, id_grado, estado, fecha_cierre, cerrado_por, hash_integridad) VALUES (2, '2do Bimestre', 2026, NULL, 'CERRADO', '2026-10-13 10:35:49.573927', 1, '32cf465f94c18c908fdd94d5a26f80d6');


--
-- Data for Name: alumnos; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (1, 7, '75918234', 'Anel Adela', 'Palomino Rojas', '2011-08-20', 1, 3, 'Traslado', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-041', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (2, 8, '74829103', 'Renato Mijael', 'Velasque Pocco', '2012-05-14', 2, 2, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-042', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (3, 9, '76829401', 'Yazid Ismael', 'Suárez Quispe', '2009-02-10', 3, 5, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-043', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (4, 10, '70000001', 'Luis', 'García', '2010-04-11', 2, 1, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-101', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (5, 11, '70000002', 'Ana', 'Rodríguez', '2010-07-20', 3, 2, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-102', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (6, 12, '70000003', 'Diego', 'Martínez', '2010-10-28', 4, 3, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-103', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (7, 13, '70000004', 'Sofía', 'López', '2011-02-05', 5, 4, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-104', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (8, 14, '70000005', 'Mateo', 'González', '2011-05-16', 6, 5, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-105', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (9, 15, '70000006', 'Valeria', 'Hernández', '2011-08-24', 7, 1, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-106', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (10, 16, '70000007', 'Sebastián', 'Pérez', '2011-12-02', 8, 2, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-107', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (12, 18, '70000009', 'Andrés', 'Ramírez', '2012-06-19', 2, 4, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-109', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (13, 19, '70000010', 'Daniela', 'Torres', '2012-09-27', 3, 5, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-110', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (15, 21, '70000012', 'Fernanda', 'Rivera', '2013-04-15', 5, 2, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-112', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (16, 22, '70000013', 'Gabriel', 'Gómez', '2013-07-24', 6, 3, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-113', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (17, 23, '70000014', 'Isabella', 'Díaz', '2013-11-01', 7, 4, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-114', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (18, 24, '70000015', 'Adrián', 'Vargas', '2014-02-09', 8, 5, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-115', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (19, 25, '78945612', 'Ana Lucía', 'Flores Quispe', '2012-03-15', 9, 2, 'Regular', NULL, 'PendientePago', NULL, NULL, NULL, NULL, 'EST-116', 2026, '2026-10-12 19:16:56.9649');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (20, 26, '98877665', 'Pedro Pablo', 'Sánchez López', '2012-05-15', 10, 2, 'Regular', NULL, 'PendientePago', NULL, NULL, NULL, NULL, 'EST-117', 2026, '2026-10-12 22:57:24.001138');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (14, 20, '70000011', 'Rodrigo', 'Flores', '2013-01-05', 4, 1, 'Regular', NULL, 'Retirado', '2026-10-13', 'Cambio Domicilio', NULL, NULL, 'EST-111', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (11, 17, '70000008', 'Camilaaa', 'Sánchez', '2012-03-11', 1, 3, 'Regular', NULL, 'Matriculado', NULL, NULL, NULL, NULL, 'EST-108', 2026, '2026-10-12 13:52:44.34357');
INSERT INTO public.alumnos (id_alumno, id_usuario, dni, nombres, apellidos, fecha_nacimiento, id_apoderado, id_grado, condicion, colegio_procedencia, estado_matricula, fecha_retiro, motivo_retiro, colegio_destino, resolucion_directoral, codigo_estudiante, anio_lectivo, fecha_creacion) VALUES (21, 29, '56784321', 'Alumno', 'Test', '2012-05-15', 11, 2, 'Regular', NULL, 'PendientePago', NULL, NULL, NULL, NULL, 'EST-118', 2026, '2026-10-13 13:39:29.36017');


--
-- Data for Name: alumnos_riesgo; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: aperturas_caja; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.aperturas_caja (id_apertura, id_caja, monto_inicial, id_usuario_apertura, fecha_apertura, observaciones) VALUES (1, 1, 100.00, 2, '2026-10-12 13:52:44.34357', 'Apertura de caja con fondo fijo de S/ 100.00');
INSERT INTO public.aperturas_caja (id_apertura, id_caja, monto_inicial, id_usuario_apertura, fecha_apertura, observaciones) VALUES (2, 1, 100.00, 2, '2026-10-13 08:34:03.912035', 'Apertura de caja con fondo fijo de S/ 100.00');


--
-- Data for Name: apoderados; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.apoderados (id_apoderado, nombres, apellidos, dni, telefono, correo) VALUES (1, 'Rosa', 'Rojas Mendoza', '09876543', '964123456', 'rosa.rojas@gmail.com');
INSERT INTO public.apoderados (id_apoderado, nombres, apellidos, dni, telefono, correo) VALUES (2, 'Carlos', 'Velasque Loayza', '08765432', '983686131', 'carlos.velasque@gmail.com');
INSERT INTO public.apoderados (id_apoderado, nombres, apellidos, dni, telefono, correo) VALUES (3, 'Jorge', 'Suárez Paredes', '07654321', '951234876', 'jorge.suarez@gmail.com');
INSERT INTO public.apoderados (id_apoderado, nombres, apellidos, dni, telefono, correo) VALUES (4, 'María', 'Quispe Huamán', '06543210', '977555111', 'maria.quispe@gmail.com');
INSERT INTO public.apoderados (id_apoderado, nombres, apellidos, dni, telefono, correo) VALUES (5, 'Pedro', 'Palomino Castro', '05432109', '966444222', 'pedro.palomino@gmail.com');
INSERT INTO public.apoderados (id_apoderado, nombres, apellidos, dni, telefono, correo) VALUES (6, 'Lucía', 'Ramos Flores', '04321098', '955333111', 'lucia.ramos@gmail.com');
INSERT INTO public.apoderados (id_apoderado, nombres, apellidos, dni, telefono, correo) VALUES (7, 'Miguel', 'Torres Vega', '03210987', '944222000', 'miguel.torres@gmail.com');
INSERT INTO public.apoderados (id_apoderado, nombres, apellidos, dni, telefono, correo) VALUES (8, 'Carmen', 'Luna Ríos', '02109876', '933111999', 'carmen.luna@gmail.com');
INSERT INTO public.apoderados (id_apoderado, nombres, apellidos, dni, telefono, correo) VALUES (9, 'María', 'Quispe Rojas', NULL, '987654321', 'maria.quispe@gmail.com');
INSERT INTO public.apoderados (id_apoderado, nombres, apellidos, dni, telefono, correo) VALUES (10, 'María', 'López Ríos', NULL, '988111222', 'maria.lopez@gmail.com');
INSERT INTO public.apoderados (id_apoderado, nombres, apellidos, dni, telefono, correo) VALUES (11, 'Papá', 'Test', NULL, '999333444', 'yarolcontacto@gmail.com');


--
-- Data for Name: asistencia_alumnos; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (1, 1, 2, 2, 3, '2026-10-05', 'Monday   ', 'P', 'Puntual en clase', false, NULL, '2026-10-12 13:52:44.34357');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (2, 1, 2, 2, 3, '2026-10-06', 'Tuesday  ', 'P', 'Puntual en clase', false, NULL, '2026-10-12 13:52:44.34357');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (3, 1, 2, 2, 3, '2026-10-07', 'Wednesday', 'T', 'Justificado por dirección (salud)', false, NULL, '2026-10-12 13:52:44.34357');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (4, 1, 2, 2, 3, '2026-10-08', 'Thursday ', 'P', 'Puntual en clase', false, NULL, '2026-10-12 13:52:44.34357');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (5, 1, 2, 2, 3, '2026-10-09', 'Friday   ', 'P', 'Puntual en clase', false, NULL, '2026-10-12 13:52:44.34357');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (6, 1, 2, 2, 3, '2026-10-12', 'Monday   ', 'P', 'Puntual en clase', false, NULL, '2026-10-12 13:52:44.34357');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (7, 1, 2, 2, 3, '2026-10-13', 'Martes', 'P', 'Puntual', false, NULL, '2026-10-12 19:38:41.477935');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (8, 1, 6, 5, 3, '2026-10-13', 'Martes', 'T', 'Llegó 10 min tarde', false, NULL, '2026-10-12 19:38:41.477935');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (9, 4, 2, 2, 1, '2026-10-13', 'Lunes', 'P', NULL, false, NULL, '2026-10-12 23:33:49.14555');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (10, 9, 2, 2, 1, '2026-10-13', 'Lunes', 'P', NULL, false, NULL, '2026-10-12 23:33:49.14555');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (11, 2, 5, 2, 2, '2026-10-13', 'Lunes', 'P', NULL, false, NULL, '2026-10-12 23:34:37.329425');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (12, 5, 5, 2, 2, '2026-10-13', 'Lunes', 'F', NULL, false, NULL, '2026-10-12 23:34:37.329425');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (13, 10, 5, 2, 2, '2026-10-13', 'Lunes', 'P', NULL, false, NULL, '2026-10-12 23:34:37.329425');
INSERT INTO public.asistencia_alumnos (id_asistencia, id_alumno, id_curso, id_personal, id_grado, fecha, dia_semana, estado, observacion, justificada, motivo_justificacion, fecha_registro) VALUES (14, 15, 5, 2, 2, '2026-10-13', 'Lunes', 'P', NULL, false, NULL, '2026-10-12 23:34:37.329425');


--
-- Data for Name: asistencia_personal; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.asistencia_personal (id_asistencia_personal, id_personal, fecha, hora_ingreso, hora_salida, estado, observacion) VALUES (1, 2, '2026-10-13', '09:53:47', NULL, 'Puntual', 'Marcación por QR');
INSERT INTO public.asistencia_personal (id_asistencia_personal, id_personal, fecha, hora_ingreso, hora_salida, estado, observacion) VALUES (2, 3, '2026-10-13', '09:54:11', NULL, 'Tardanza', 'Marcación por QR - Tardanza');


--
-- Data for Name: becas; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.becas (id_beca, id_alumno, tipo, porcentaje_descuento, monto_descuento, fecha_inicio, fecha_fin, activo) VALUES (1, 3, 'EXCELENCIA', 100.00, 0.00, '2026-03-01', NULL, true);
INSERT INTO public.becas (id_beca, id_alumno, tipo, porcentaje_descuento, monto_descuento, fecha_inicio, fecha_fin, activo) VALUES (2, 1, 'SOCIOECONOMICA', 50.00, 125.00, '2026-03-01', NULL, true);


--
-- Data for Name: bitacora_auditoria; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.bitacora_auditoria (id_bitacora, id_usuario, fecha_hora, modulo_afectado, accion, descripcion, valor_anterior, valor_nuevo, ip_origen) VALUES (1, NULL, '2026-10-12 13:52:44.34357', 'Evaluaciones', 'CREAR', 'Calificación alumno ID 1', NULL, '{"calificacion": "A"}', NULL);
INSERT INTO public.bitacora_auditoria (id_bitacora, id_usuario, fecha_hora, modulo_afectado, accion, descripcion, valor_anterior, valor_nuevo, ip_origen) VALUES (2, NULL, '2026-10-12 13:52:44.34357', 'Evaluaciones', 'CREAR', 'Calificación alumno ID 1', NULL, '{"calificacion": "AD"}', NULL);
INSERT INTO public.bitacora_auditoria (id_bitacora, id_usuario, fecha_hora, modulo_afectado, accion, descripcion, valor_anterior, valor_nuevo, ip_origen) VALUES (3, NULL, '2026-10-12 13:52:44.34357', 'Evaluaciones', 'CREAR', 'Calificación alumno ID 1', NULL, '{"calificacion": "A"}', NULL);
INSERT INTO public.bitacora_auditoria (id_bitacora, id_usuario, fecha_hora, modulo_afectado, accion, descripcion, valor_anterior, valor_nuevo, ip_origen) VALUES (4, NULL, '2026-10-12 13:52:44.34357', 'Evaluaciones', 'CREAR', 'Calificación alumno ID 1', NULL, '{"calificacion": "A"}', NULL);
INSERT INTO public.bitacora_auditoria (id_bitacora, id_usuario, fecha_hora, modulo_afectado, accion, descripcion, valor_anterior, valor_nuevo, ip_origen) VALUES (5, 1, '2026-10-12 13:52:44.34357', 'Seguridad', 'LOGIN', 'Inicio de sesión de Administrador', NULL, NULL, '192.168.1.45');
INSERT INTO public.bitacora_auditoria (id_bitacora, id_usuario, fecha_hora, modulo_afectado, accion, descripcion, valor_anterior, valor_nuevo, ip_origen) VALUES (6, 3, '2026-10-12 13:52:44.34357', 'Evaluaciones', 'MODIFICAR', 'Rectificación de nota en Química - Anel Palomino', NULL, NULL, '192.168.1.88');
INSERT INTO public.bitacora_auditoria (id_bitacora, id_usuario, fecha_hora, modulo_afectado, accion, descripcion, valor_anterior, valor_nuevo, ip_origen) VALUES (7, 2, '2026-10-12 13:52:44.34357', 'Tesorería', 'CREAR', 'Emisión de Boleta B001-004822 por Matrícula', NULL, NULL, '192.168.1.12');
INSERT INTO public.bitacora_auditoria (id_bitacora, id_usuario, fecha_hora, modulo_afectado, accion, descripcion, valor_anterior, valor_nuevo, ip_origen) VALUES (8, NULL, '2026-10-12 23:25:51.748901', 'Evaluaciones', 'MODIFICAR', 'Calificación alumno ID 1', '{"calificacion": "A"}', '{"calificacion": "AD"}', NULL);


--
-- Data for Name: boletas_electronicas; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.boletas_electronicas (id_boleta, id_pago, numero_boleta, serie, numero, fecha_emision, monto_total, estado_sunat, xml_url, pdf_url, hash_cpe) VALUES (1, 1, 'B001-004821', 'B001', 4821, '2026-10-12 13:52:44.34357', 250.00, 'ACEPTADO', NULL, NULL, NULL);
INSERT INTO public.boletas_electronicas (id_boleta, id_pago, numero_boleta, serie, numero, fecha_emision, monto_total, estado_sunat, xml_url, pdf_url, hash_cpe) VALUES (2, 2, 'B001-004822', 'B001', 4822, '2026-10-12 13:52:44.34357', 250.00, 'ACEPTADO', NULL, NULL, NULL);
INSERT INTO public.boletas_electronicas (id_boleta, id_pago, numero_boleta, serie, numero, fecha_emision, monto_total, estado_sunat, xml_url, pdf_url, hash_cpe) VALUES (3, 3, 'B001-004823', 'B001', 4823, '2026-10-12 13:52:44.34357', 250.00, 'ACEPTADO', NULL, NULL, NULL);
INSERT INTO public.boletas_electronicas (id_boleta, id_pago, numero_boleta, serie, numero, fecha_emision, monto_total, estado_sunat, xml_url, pdf_url, hash_cpe) VALUES (4, 4, 'B001-004824', 'B001', 4824, '2026-10-12 13:52:44.34357', 250.00, 'ACEPTADO', NULL, NULL, NULL);
INSERT INTO public.boletas_electronicas (id_boleta, id_pago, numero_boleta, serie, numero, fecha_emision, monto_total, estado_sunat, xml_url, pdf_url, hash_cpe) VALUES (5, 5, 'B001-004825', 'B001', 4825, '2026-10-12 13:52:44.34357', 250.00, 'ACEPTADO', NULL, NULL, NULL);
INSERT INTO public.boletas_electronicas (id_boleta, id_pago, numero_boleta, serie, numero, fecha_emision, monto_total, estado_sunat, xml_url, pdf_url, hash_cpe) VALUES (6, 7, 'B001-004826', 'B001', 4826, '2026-10-12 19:54:05.140684', 250.00, 'ACEPTADO', NULL, NULL, '49043a886e8f18a38bb9534ad9c9635f');
INSERT INTO public.boletas_electronicas (id_boleta, id_pago, numero_boleta, serie, numero, fecha_emision, monto_total, estado_sunat, xml_url, pdf_url, hash_cpe) VALUES (7, 8, 'B001-004827', 'B001', 4827, '2026-10-13 00:11:53.36153', 250.00, 'ACEPTADO', NULL, NULL, '66d3d6dc2d64f57049a29ede86949ec4');
INSERT INTO public.boletas_electronicas (id_boleta, id_pago, numero_boleta, serie, numero, fecha_emision, monto_total, estado_sunat, xml_url, pdf_url, hash_cpe) VALUES (8, 9, 'B001-004828', 'B001', 4828, '2026-10-13 00:12:50.411623', 250.00, 'ACEPTADO', NULL, NULL, '1e02a0d7ac017f7d5d9777dbb6e30b2c');
INSERT INTO public.boletas_electronicas (id_boleta, id_pago, numero_boleta, serie, numero, fecha_emision, monto_total, estado_sunat, xml_url, pdf_url, hash_cpe) VALUES (9, 10, 'B001-004829', 'B001', 4829, '2026-10-13 00:30:56.425646', 250.00, 'ACEPTADO', NULL, NULL, 'd2a7022c01088124fecbdab720325e34');
INSERT INTO public.boletas_electronicas (id_boleta, id_pago, numero_boleta, serie, numero, fecha_emision, monto_total, estado_sunat, xml_url, pdf_url, hash_cpe) VALUES (10, 11, 'B001-004830', 'B001', 4830, '2026-10-13 00:37:34.562802', 250.00, 'ACEPTADO', NULL, NULL, 'b40cab716598a288d5670aa2e290770e');


--
-- Data for Name: cajas; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.cajas (id_caja, nombre_caja, responsable, estado) VALUES (1, 'Caja N° 01 - Ventanilla Principal', 2, 'CERRADA');


--
-- Data for Name: calificaciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.calificaciones (id_calificacion, id_alumno, id_curso, id_competencia, id_personal, id_grado, bimestre, anio_lectivo, calificacion, fecha_registro, fecha_modificacion, modificado_por, justificacion_modificacion) VALUES (2, 1, 2, 6, 2, 3, 2, 2026, 'AD', '2026-10-12 13:52:44.34357', NULL, NULL, NULL);
INSERT INTO public.calificaciones (id_calificacion, id_alumno, id_curso, id_competencia, id_personal, id_grado, bimestre, anio_lectivo, calificacion, fecha_registro, fecha_modificacion, modificado_por, justificacion_modificacion) VALUES (3, 1, 2, 7, 2, 3, 2, 2026, 'A', '2026-10-12 13:52:44.34357', NULL, NULL, NULL);
INSERT INTO public.calificaciones (id_calificacion, id_alumno, id_curso, id_competencia, id_personal, id_grado, bimestre, anio_lectivo, calificacion, fecha_registro, fecha_modificacion, modificado_por, justificacion_modificacion) VALUES (4, 1, 2, 8, 2, 3, 2, 2026, 'A', '2026-10-12 13:52:44.34357', NULL, NULL, NULL);
INSERT INTO public.calificaciones (id_calificacion, id_alumno, id_curso, id_competencia, id_personal, id_grado, bimestre, anio_lectivo, calificacion, fecha_registro, fecha_modificacion, modificado_por, justificacion_modificacion) VALUES (1, 1, 2, 5, 2, 3, 2, 2026, 'AD', '2026-10-12 13:52:44.34357', '2026-10-12 23:25:51.748901', NULL, NULL);


--
-- Data for Name: carga_curricular; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (1, 1, 1, 2, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (2, 1, 2, 2, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (3, 1, 3, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (4, 1, 4, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (5, 1, 5, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (6, 1, 6, 5, 2026, 4);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (7, 1, 7, 5, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (9, 1, 9, 4, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (10, 1, 10, 3, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (11, 1, 11, 3, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (12, 2, 1, 2, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (13, 2, 2, 2, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (14, 2, 3, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (15, 2, 4, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (16, 2, 5, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (17, 2, 6, 5, 2026, 4);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (18, 2, 7, 5, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (19, 2, 8, 4, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (20, 2, 9, 4, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (21, 2, 10, 3, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (22, 2, 11, 3, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (23, 3, 1, 2, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (24, 3, 2, 2, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (25, 3, 3, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (26, 3, 4, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (27, 3, 5, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (28, 3, 6, 5, 2026, 4);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (29, 3, 7, 5, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (30, 3, 8, 4, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (31, 3, 9, 4, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (32, 3, 10, 3, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (33, 3, 11, 3, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (34, 4, 1, 2, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (35, 4, 2, 2, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (36, 4, 3, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (37, 4, 4, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (38, 4, 5, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (39, 4, 6, 5, 2026, 4);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (40, 4, 7, 5, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (41, 4, 8, 4, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (42, 4, 9, 4, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (43, 4, 10, 3, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (44, 4, 11, 3, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (45, 5, 1, 2, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (46, 5, 2, 2, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (47, 5, 3, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (48, 5, 4, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (49, 5, 5, 2, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (50, 5, 6, 5, 2026, 4);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (51, 5, 7, 5, 2026, 2);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (52, 5, 8, 4, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (53, 5, 9, 4, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (54, 5, 10, 3, 2026, 3);
INSERT INTO public.carga_curricular (id_carga, id_grado, id_curso, id_personal, anio_lectivo, horas_asignadas) VALUES (55, 5, 11, 3, 2026, 2);


--
-- Data for Name: cierres_caja; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.cierres_caja (id_cierre, id_apertura, monto_apertura, total_ingresos_efectivo, total_ingresos_digital, total_egresos, efectivo_esperado, efectivo_fisico, diferencia, total_general, id_usuario_cierre, fecha_cierre, estado) VALUES (1, 1, 100.00, 250.00, 0.00, 45.00, 305.00, 55.00, -250.00, 55.00, 1, '2026-10-12 19:59:32.850193', 'FALTANTE');
INSERT INTO public.cierres_caja (id_cierre, id_apertura, monto_apertura, total_ingresos_efectivo, total_ingresos_digital, total_egresos, efectivo_esperado, efectivo_fisico, diferencia, total_general, id_usuario_cierre, fecha_cierre, estado) VALUES (2, 2, 100.00, 0.00, 0.00, 55.00, 45.00, 45.00, 0.00, 45.00, 2, '2026-10-13 08:38:35.005836', 'CUADRADO');


--
-- Data for Name: competencias; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (1, 1, 'Resuelve problemas de cantidad', 1);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (2, 1, 'Resuelve problemas de regularidad, equivalencia y cambio', 2);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (3, 1, 'Resuelve problemas de forma, movimiento y localización', 3);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (4, 1, 'Resuelve problemas de gestión de datos e incertidumbre', 4);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (5, 2, 'Resuelve problemas de cantidad', 1);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (6, 2, 'Resuelve problemas de regularidad, equivalencia y cambio', 2);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (7, 2, 'Resuelve problemas de forma, movimiento y localización', 3);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (8, 2, 'Resuelve problemas de gestión de datos e incertidumbre', 4);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (9, 3, 'Resuelve problemas de forma, movimiento y localización', 1);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (10, 3, 'Resuelve problemas de regularidad, equivalencia y cambio', 2);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (11, 4, 'Resuelve problemas de forma, movimiento y localización', 1);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (12, 4, 'Resuelve problemas de gestión de datos e incertidumbre', 2);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (13, 5, 'Resuelve problemas de cantidad', 1);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (14, 5, 'Resuelve problemas de regularidad, equivalencia y cambio', 2);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (15, 6, 'Se comunica oralmente en su lengua materna', 1);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (16, 6, 'Lee diversos tipos de textos escritos', 2);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (17, 6, 'Escribe diversos tipos de textos', 3);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (18, 7, 'Lee diversos tipos de textos escritos', 1);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (19, 7, 'Escribe diversos tipos de textos', 2);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (20, 8, 'Indaga mediante métodos científicos', 1);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (21, 8, 'Explica el mundo físico basándose en conocimientos', 2);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (22, 8, 'Diseña y construye soluciones tecnológicas', 3);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (23, 9, 'Indaga mediante métodos científicos', 1);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (24, 9, 'Explica el mundo físico basándose en conocimientos', 2);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (25, 9, 'Diseña y construye soluciones tecnológicas', 3);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (26, 10, 'Construye interpretaciones históricas', 1);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (27, 10, 'Gestiona responsablemente el espacio y el ambiente', 2);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (28, 11, 'Gestiona responsablemente el espacio y el ambiente', 1);
INSERT INTO public.competencias (id_competencia, id_curso, nombre_competencia, orden) VALUES (29, 11, 'Gestiona responsablemente los recursos económicos', 2);


--
-- Data for Name: conceptos_pago; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.conceptos_pago (id_concepto, nombre, monto_base, tipo, mes, anio_lectivo) VALUES (1, 'Matrícula Escolar 2026', 250.00, 'MATRICULA', NULL, 2026);
INSERT INTO public.conceptos_pago (id_concepto, nombre, monto_base, tipo, mes, anio_lectivo) VALUES (2, 'Pensión Marzo 2026', 250.00, 'PENSION', 3, 2026);
INSERT INTO public.conceptos_pago (id_concepto, nombre, monto_base, tipo, mes, anio_lectivo) VALUES (3, 'Pensión Abril 2026', 250.00, 'PENSION', 4, 2026);
INSERT INTO public.conceptos_pago (id_concepto, nombre, monto_base, tipo, mes, anio_lectivo) VALUES (4, 'Pensión Mayo 2026', 250.00, 'PENSION', 5, 2026);
INSERT INTO public.conceptos_pago (id_concepto, nombre, monto_base, tipo, mes, anio_lectivo) VALUES (5, 'Pensión Junio 2026', 250.00, 'PENSION', 6, 2026);
INSERT INTO public.conceptos_pago (id_concepto, nombre, monto_base, tipo, mes, anio_lectivo) VALUES (6, 'Pensión Julio 2026', 250.00, 'PENSION', 7, 2026);
INSERT INTO public.conceptos_pago (id_concepto, nombre, monto_base, tipo, mes, anio_lectivo) VALUES (7, 'Pensión Agosto 2026', 250.00, 'PENSION', 8, 2026);
INSERT INTO public.conceptos_pago (id_concepto, nombre, monto_base, tipo, mes, anio_lectivo) VALUES (8, 'Pensión Setiembre 2026', 250.00, 'PENSION', 9, 2026);
INSERT INTO public.conceptos_pago (id_concepto, nombre, monto_base, tipo, mes, anio_lectivo) VALUES (9, 'Pensión Octubre 2026', 250.00, 'PENSION', 10, 2026);
INSERT INTO public.conceptos_pago (id_concepto, nombre, monto_base, tipo, mes, anio_lectivo) VALUES (10, 'Pensión Noviembre 2026', 250.00, 'PENSION', 11, 2026);
INSERT INTO public.conceptos_pago (id_concepto, nombre, monto_base, tipo, mes, anio_lectivo) VALUES (11, 'Pensión Diciembre 2026', 250.00, 'PENSION', 12, 2026);


--
-- Data for Name: conclusiones_descriptivas; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.conclusiones_descriptivas (id_conclusion, id_alumno, id_curso, bimestre, anio_lectivo, descripcion, id_personal) VALUES (1, 1, 2, 2, 2026, 'Resuelve ecuaciones polinómicas con precisión.', 2);


--
-- Data for Name: credenciales_qr; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (1, 1, 'QR-74829102-96604517CC1A1B838ADE885E69AFDF3B', 'ADMIN', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (2, 2, 'QR-40596837-42603C5E0678B69E93B80FDF29355FD3', 'SECRETARIA', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (3, 3, 'QR-10293847-B3D6F1BF081DBFD228A2D18A846DBB41', 'DOCENTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (4, 4, 'QR-20394812-AC58F59D0D4ED5CE3D1A56FE33F9BA72', 'DOCENTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (5, 5, 'QR-30192847-A3967E9DC639C256C1FB351F16E3187F', 'DOCENTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (6, 6, 'QR-50182736-2D8FBB37294BB968B88AA43094999260', 'DOCENTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (7, 7, 'QR-75918234-C48DC556B4695FC4DAC61F224F631AE9', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (8, 8, 'QR-74829103-5D1B4C12B16C73D776DD827359228BF1', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (9, 9, 'QR-76829401-E164FD0EDDA8D71CE1ED41759899B885', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (10, 10, 'QR-70000001-B831BAA2F62F6A038589DEC43AEABBB9', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (11, 11, 'QR-70000002-6BF6024F3D4A6BC03562529547CDD5FD', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (12, 12, 'QR-70000003-812D48FC9C58AA31528D6C2D68AB1F30', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (13, 13, 'QR-70000004-43D84117C5CEEEBE0914283C420A4EDD', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (14, 14, 'QR-70000005-55E9FCA9A8084F654B5F173D7F6AA634', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (15, 15, 'QR-70000006-795DBDC31C6403310BD7CF1A6916213F', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (16, 16, 'QR-70000007-9072857ED7EBA698155219E7DB1046E2', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (17, 17, 'QR-70000008-FD6FF28DB2AF3CBAEBE1AD773B67AD7A', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (18, 18, 'QR-70000009-E22EF46DA0F51E924CAD472A8DA8CE6C', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (19, 19, 'QR-70000010-AC29D3009A19D590182DACE97BD545AB', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (20, 20, 'QR-70000011-02897665CE5502458654DF2AD024D4A2', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (21, 21, 'QR-70000012-B6403B33A30703C6F58FD7B87695E4A9', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (22, 22, 'QR-70000013-74CA34E2B066F4C0F90143D2CA26F5E7', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (23, 23, 'QR-70000014-73323B875F4051CDA0F1E4C2D1EBE933', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (24, 24, 'QR-70000015-E8CF6C282C31AA2E5C93832BE6821338', 'ESTUDIANTE', '2026-10-12 13:52:44.34357', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (25, 25, 'QR-78945612-67AA71A0E8A3484AE938284BBC9A05DB', 'ESTUDIANTE', '2026-10-12 19:16:56.9649', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (26, 26, 'QR-98877665-8965E4798B804AB532F19708DE60F3C2', 'ESTUDIANTE', '2026-10-12 22:57:24.001138', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (27, 27, 'QR-19873022-F40EFDA891DA7CF993CE8505D8BB0BA9', 'DOCENTE', '2026-10-13 09:19:42.855695', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (28, 28, 'QR-56781234-538EABB43E803901E7238892CA4F68B9', 'DOCENTE', '2026-10-13 13:37:42.722956', true);
INSERT INTO public.credenciales_qr (id_credencial, id_usuario, codigo_qr, tipo, fecha_emision, activo) VALUES (29, 29, 'QR-56784321-7FF7A245A9D51AC759F218B093C1979D', 'ESTUDIANTE', '2026-10-13 13:39:29.36017', true);


--
-- Data for Name: cuadro_merito; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: cursos; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.cursos (id_curso, nombre_curso, area_academica, horas_semanales) VALUES (1, 'Aritmética', 'Matemáticas', 3);
INSERT INTO public.cursos (id_curso, nombre_curso, area_academica, horas_semanales) VALUES (2, 'Álgebra', 'Matemáticas', 3);
INSERT INTO public.cursos (id_curso, nombre_curso, area_academica, horas_semanales) VALUES (3, 'Trigonometría', 'Matemáticas', 2);
INSERT INTO public.cursos (id_curso, nombre_curso, area_academica, horas_semanales) VALUES (4, 'Geometría', 'Matemáticas', 2);
INSERT INTO public.cursos (id_curso, nombre_curso, area_academica, horas_semanales) VALUES (5, 'Razonamiento Matemático', 'Matemáticas', 2);
INSERT INTO public.cursos (id_curso, nombre_curso, area_academica, horas_semanales) VALUES (6, 'Comunicación', 'Lenguaje y Letras', 4);
INSERT INTO public.cursos (id_curso, nombre_curso, area_academica, horas_semanales) VALUES (7, 'Razonamiento Verbal', 'Lenguaje y Letras', 2);
INSERT INTO public.cursos (id_curso, nombre_curso, area_academica, horas_semanales) VALUES (8, 'Física', 'Ciencias Naturales', 3);
INSERT INTO public.cursos (id_curso, nombre_curso, area_academica, horas_semanales) VALUES (9, 'Química', 'Ciencias Naturales', 3);
INSERT INTO public.cursos (id_curso, nombre_curso, area_academica, horas_semanales) VALUES (10, 'Historia', 'Ciencias Sociales', 3);
INSERT INTO public.cursos (id_curso, nombre_curso, area_academica, horas_semanales) VALUES (11, 'Geografía', 'Ciencias Sociales', 2);


--
-- Data for Name: escala_calificacion; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.escala_calificacion (id_escala, codigo, descripcion, orden) VALUES (1, 'AD', 'Logro Destacado', 1);
INSERT INTO public.escala_calificacion (id_escala, codigo, descripcion, orden) VALUES (2, 'A', 'Logro Esperado', 2);
INSERT INTO public.escala_calificacion (id_escala, codigo, descripcion, orden) VALUES (3, 'B', 'En Proceso', 3);
INSERT INTO public.escala_calificacion (id_escala, codigo, descripcion, orden) VALUES (4, 'C', 'En Inicio', 4);


--
-- Data for Name: estado_carga_docentes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: expediente_alumno; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (1, 1, 'A', 98.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (2, 2, 'AD', 95.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (3, 3, 'AD', 100.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (4, 4, 'AD', 91.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (5, 5, 'A', 92.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (6, 6, 'A', 93.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (7, 7, 'B', 94.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (8, 8, 'AD', 95.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (9, 9, 'A', 96.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (10, 10, 'A', 97.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (11, 11, 'B', 98.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (12, 12, 'AD', 99.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (13, 13, 'A', 100.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (14, 14, 'A', 101.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (15, 15, 'B', 102.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (16, 16, 'AD', 103.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (17, 17, 'A', 104.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (18, 18, 'A', 105.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (19, 19, NULL, 0.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (20, 20, NULL, 0.00, false);
INSERT INTO public.expediente_alumno (id_expediente, id_alumno, nivel_logro_actual, asistencia_acumulada, congelado) VALUES (21, 21, NULL, 0.00, false);


--
-- Data for Name: exportaciones_siagie; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.exportaciones_siagie (id_exportacion, id_grado, bimestre, anio_lectivo, nombre_archivo, fecha_generacion, id_usuario, estado) VALUES (1, 1, 2, 2026, 'SIAGIE_1ro_de_Secundaria_BIM2_2026.xlsx', '2026-10-13 12:07:29.258195', 1, 'GENERADO');
INSERT INTO public.exportaciones_siagie (id_exportacion, id_grado, bimestre, anio_lectivo, nombre_archivo, fecha_generacion, id_usuario, estado) VALUES (2, 1, 2, 2026, 'SIAGIE_1ro_de_Secundaria_BIM2_2026.xlsx', '2026-10-13 12:08:10.099564', 1, 'GENERADO');
INSERT INTO public.exportaciones_siagie (id_exportacion, id_grado, bimestre, anio_lectivo, nombre_archivo, fecha_generacion, id_usuario, estado) VALUES (3, 1, 2, 2026, 'SIAGIE_1ro_de_Secundaria_BIM2_2026.xlsx', '2026-10-13 12:10:19.890561', 1, 'GENERADO');
INSERT INTO public.exportaciones_siagie (id_exportacion, id_grado, bimestre, anio_lectivo, nombre_archivo, fecha_generacion, id_usuario, estado) VALUES (4, 1, 2, 2026, 'SIAGIE_1ro_de_Secundaria_BIM2_2026.xlsx', '2026-10-13 12:16:59.662693', 1, 'GENERADO');


--
-- Data for Name: grados; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.grados (id_grado, nombre_grado, nivel, seccion, anio_lectivo) VALUES (1, '1ro de Secundaria', 'SECUNDARIA', 'Única', 2026);
INSERT INTO public.grados (id_grado, nombre_grado, nivel, seccion, anio_lectivo) VALUES (2, '2do de Secundaria', 'SECUNDARIA', 'Única', 2026);
INSERT INTO public.grados (id_grado, nombre_grado, nivel, seccion, anio_lectivo) VALUES (3, '3ro de Secundaria', 'SECUNDARIA', 'Única', 2026);
INSERT INTO public.grados (id_grado, nombre_grado, nivel, seccion, anio_lectivo) VALUES (4, '4to de Secundaria', 'SECUNDARIA', 'Única', 2026);
INSERT INTO public.grados (id_grado, nombre_grado, nivel, seccion, anio_lectivo) VALUES (5, '5to de Secundaria', 'SECUNDARIA', 'Única', 2026);


--
-- Data for Name: horarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (1, 2, 1, 2, 'Lunes', '07:30:00', '08:15:00', 'CLASE');
INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (2, 2, 1, 2, 'Lunes', '08:15:00', '09:00:00', 'CLASE');
INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (3, 2, NULL, NULL, 'Lunes', '09:00:00', '09:30:00', 'RECREO');
INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (4, 2, 3, 2, 'Lunes', '09:30:00', '10:15:00', 'CLASE');
INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (5, 2, 4, 2, 'Lunes', '10:15:00', '11:00:00', 'CLASE');
INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (6, 2, 6, 5, 'Martes', '07:30:00', '08:15:00', 'CLASE');
INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (7, 2, 6, 5, 'Martes', '08:15:00', '09:00:00', 'CLASE');
INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (8, 2, NULL, NULL, 'Martes', '09:00:00', '09:30:00', 'RECREO');
INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (9, 2, 7, 5, 'Martes', '09:30:00', '10:15:00', 'CLASE');
INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (10, 2, 8, 4, 'Miércoles', '07:30:00', '08:15:00', 'CLASE');
INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (11, 2, 8, 4, 'Miércoles', '08:15:00', '09:00:00', 'CLASE');
INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (12, 2, NULL, NULL, 'Miércoles', '09:00:00', '09:30:00', 'RECREO');
INSERT INTO public.horarios (id_horario, id_grado, id_curso, id_personal, dia_semana, hora_inicio, hora_fin, tipo_bloque) VALUES (13, 2, 5, 2, 'Miércoles', '09:30:00', '10:15:00', 'CLASE');


--
-- Data for Name: libretas; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: movimientos_caja; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.movimientos_caja (id_movimiento, id_apertura, id_pago, tipo, concepto, monto, medio_pago, nro_comprobante, fecha_hora, id_usuario) VALUES (2, 1, 7, 'INGRESO', 'Cobro registrado - Pago ID 7', 250.00, 'Efectivo', NULL, '2026-10-12 19:54:05.140684', 1);
INSERT INTO public.movimientos_caja (id_movimiento, id_apertura, id_pago, tipo, concepto, monto, medio_pago, nro_comprobante, fecha_hora, id_usuario) VALUES (3, 1, NULL, 'EGRESO', 'Compra de útiles de limpieza', 45.00, 'Efectivo', 'VALE-0012', '2026-10-12 19:59:17.283802', 1);
INSERT INTO public.movimientos_caja (id_movimiento, id_apertura, id_pago, tipo, concepto, monto, medio_pago, nro_comprobante, fecha_hora, id_usuario) VALUES (4, 1, 8, 'INGRESO', 'Cobro registrado - Pago ID 8', 250.00, 'Efectivo', NULL, '2026-10-13 00:11:53.36153', 2);
INSERT INTO public.movimientos_caja (id_movimiento, id_apertura, id_pago, tipo, concepto, monto, medio_pago, nro_comprobante, fecha_hora, id_usuario) VALUES (5, 1, 9, 'INGRESO', 'Cobro registrado - Pago ID 9', 250.00, 'Efectivo', NULL, '2026-10-13 00:12:50.411623', 2);
INSERT INTO public.movimientos_caja (id_movimiento, id_apertura, id_pago, tipo, concepto, monto, medio_pago, nro_comprobante, fecha_hora, id_usuario) VALUES (6, 1, 10, 'INGRESO', 'Cobro registrado - Pago ID 10', 250.00, 'Efectivo', NULL, '2026-10-13 00:30:56.425646', 2);
INSERT INTO public.movimientos_caja (id_movimiento, id_apertura, id_pago, tipo, concepto, monto, medio_pago, nro_comprobante, fecha_hora, id_usuario) VALUES (7, 1, 11, 'INGRESO', 'Cobro registrado - Pago ID 11', 250.00, 'Efectivo', NULL, '2026-10-13 00:37:34.562802', 2);
INSERT INTO public.movimientos_caja (id_movimiento, id_apertura, id_pago, tipo, concepto, monto, medio_pago, nro_comprobante, fecha_hora, id_usuario) VALUES (8, 2, NULL, 'APERTURA', 'Fondo inicial de caja', 100.00, 'Efectivo', NULL, '2026-10-13 08:34:03.912035', 2);
INSERT INTO public.movimientos_caja (id_movimiento, id_apertura, id_pago, tipo, concepto, monto, medio_pago, nro_comprobante, fecha_hora, id_usuario) VALUES (9, 2, NULL, 'EGRESO', 'Movilidad', 10.00, 'Efectivo', 'CP-001', '2026-10-13 08:35:42.129672', 2);
INSERT INTO public.movimientos_caja (id_movimiento, id_apertura, id_pago, tipo, concepto, monto, medio_pago, nro_comprobante, fecha_hora, id_usuario) VALUES (10, 2, NULL, 'EGRESO', 'Compra de útiles de limpieza', 45.00, 'Efectivo', 'VALE-0012', '2026-10-13 08:38:24.117792', 2);


--
-- Data for Name: notas_finales_area; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.notas_finales_area (id_nota_final, id_alumno, id_curso, bimestre, anio_lectivo, nota_final, calculo_automatico) VALUES (1, 1, 2, 2, 2026, 'A', true);


--
-- Data for Name: notificaciones; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.notificaciones (id_notificacion, id_usuario_destino, id_usuario_remitente, asunto, cuerpo, leido, fecha_envio) VALUES (2, 3, 1, 'Reunión de Coordinación de Área', 'Se cita a los profesores del área de Ciencia y Matemática a la reunión de coordinación pedagógica este viernes a las 11:00 AM.', true, '2026-10-12 13:52:44.34357');
INSERT INTO public.notificaciones (id_notificacion, id_usuario_destino, id_usuario_remitente, asunto, cuerpo, leido, fecha_envio) VALUES (3, 3, 1, 'Reunión de coordinación', 'Se cita a reunión el viernes a las 11 AM en la sala de profesores.', true, '2026-10-12 20:12:37.536863');
INSERT INTO public.notificaciones (id_notificacion, id_usuario_destino, id_usuario_remitente, asunto, cuerpo, leido, fecha_envio) VALUES (1, 3, 1, 'Recordatorio Urgente: Registro de Calificaciones - Álgebra', 'Estimado Prof. Carlos Mendoza, le recordamos que el plazo para la subida de actas de calificaciones de 3ro de Secundaria vence el día de hoy a las 18:00 hrs.', true, '2026-10-12 13:52:44.34357');
INSERT INTO public.notificaciones (id_notificacion, id_usuario_destino, id_usuario_remitente, asunto, cuerpo, leido, fecha_envio) VALUES (4, 3, 1, 'Prueba de Notificación Real desde SIGA-UC', '¡Hola! Este correo fue enviado automáticamente por el sistema SIGA-UC. Si lo recibes, el módulo de notificaciones reales funciona correctamente. 🎉', false, '2026-10-13 12:39:20.638993');
INSERT INTO public.notificaciones (id_notificacion, id_usuario_destino, id_usuario_remitente, asunto, cuerpo, leido, fecha_envio) VALUES (5, 5, 1, 'Recordatorio: Notas Pendientes — Física 3ro de Secundaria II Bimestre', 'Estimado(a) Prof. Giancarlo Vilchez Rojas,

Te recordamos que tienes notas pendientes de registrar en el curso de Física para el 3ro de Secundaria — II Bimestre 2026.

📊 Alumnos pendientes: 4 de 4 (0.00% completado)

Por favor, ingresa al módulo "Registro de Notas" para completar las calificaciones antes del cierre del bimestre.

Atentamente,
Dirección Académica — I.E.P. Unión Científica', false, '2026-10-13 14:14:23.510603');
INSERT INTO public.notificaciones (id_notificacion, id_usuario_destino, id_usuario_remitente, asunto, cuerpo, leido, fecha_envio) VALUES (6, 5, 1, 'Recordatorio: Notas Pendientes — Física 3ro de Secundaria II Bimestre', 'Estimado(a) Prof. Giancarlo Vilchez Rojas,

Te recordamos que tienes notas pendientes de registrar en el curso de Física para el 3ro de Secundaria — II Bimestre 2026.

📊 Alumnos pendientes: 4 de 4 (0.00% completado)

Por favor, ingresa al módulo "Registro de Notas" para completar las calificaciones antes del cierre del bimestre.

Atentamente,
Dirección Académica — I.E.P. Unión Científica', false, '2026-10-13 14:15:33.394307');
INSERT INTO public.notificaciones (id_notificacion, id_usuario_destino, id_usuario_remitente, asunto, cuerpo, leido, fecha_envio) VALUES (7, 5, 1, 'Recordatorio: Notas Pendientes — Física 3ro de Secundaria II Bimestre', 'Estimado(a) Prof. Giancarlo Vilchez Rojas,

Te recordamos que tienes notas pendientes de registrar en el curso de Física para el 3ro de Secundaria — II Bimestre 2026.

📊 Alumnos pendientes: 4 de 4 (0.00% completado)

Por favor, ingresa al módulo "Registro de Notas" para completar las calificaciones antes del cierre del bimestre.

Atentamente,
Dirección Académica — I.E.P. Unión Científica', false, '2026-10-13 14:37:15.650294');
INSERT INTO public.notificaciones (id_notificacion, id_usuario_destino, id_usuario_remitente, asunto, cuerpo, leido, fecha_envio) VALUES (8, 5, 1, 'Recordatorio: Notas Pendientes — Física 3ro de Secundaria II Bimestre', 'Estimado(a) Prof. Giancarlo Vilchez Rojas,

Te recordamos que tienes notas pendientes de registrar en el curso de Física para el 3ro de Secundaria — II Bimestre 2026.

📊 Alumnos pendientes: 4 de 4 (0.00% completado)

Por favor, ingresa al módulo "Registro de Notas" para completar las calificaciones antes del cierre del bimestre.

Atentamente,
Dirección Académica — I.E.P. Unión Científica', false, '2026-10-13 14:42:20.720129');


--
-- Data for Name: pagos; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.pagos (id_pago, id_alumno, id_preticket, id_pension, id_concepto, monto, forma_pago, nro_operacion, fecha_pago, id_usuario_cobrador, estado) VALUES (1, 1, NULL, NULL, 8, 250.00, 'Efectivo', 'OP-4821', '2026-10-12 13:52:44.34357', 2, 'PAGADO');
INSERT INTO public.pagos (id_pago, id_alumno, id_preticket, id_pension, id_concepto, monto, forma_pago, nro_operacion, fecha_pago, id_usuario_cobrador, estado) VALUES (2, 2, NULL, NULL, 8, 250.00, 'Efectivo', 'OP-4822', '2026-10-12 13:52:44.34357', 2, 'PAGADO');
INSERT INTO public.pagos (id_pago, id_alumno, id_preticket, id_pension, id_concepto, monto, forma_pago, nro_operacion, fecha_pago, id_usuario_cobrador, estado) VALUES (3, 3, NULL, NULL, 8, 250.00, 'Efectivo', 'OP-4823', '2026-10-12 13:52:44.34357', 2, 'PAGADO');
INSERT INTO public.pagos (id_pago, id_alumno, id_preticket, id_pension, id_concepto, monto, forma_pago, nro_operacion, fecha_pago, id_usuario_cobrador, estado) VALUES (4, 4, NULL, NULL, 8, 250.00, 'Efectivo', 'OP-4824', '2026-10-12 13:52:44.34357', 2, 'PAGADO');
INSERT INTO public.pagos (id_pago, id_alumno, id_preticket, id_pension, id_concepto, monto, forma_pago, nro_operacion, fecha_pago, id_usuario_cobrador, estado) VALUES (5, 5, NULL, NULL, 8, 250.00, 'Efectivo', 'OP-4825', '2026-10-12 13:52:44.34357', 2, 'PAGADO');
INSERT INTO public.pagos (id_pago, id_alumno, id_preticket, id_pension, id_concepto, monto, forma_pago, nro_operacion, fecha_pago, id_usuario_cobrador, estado) VALUES (7, 1, NULL, NULL, 9, 250.00, 'Efectivo', 'OP-12345', '2026-10-12 19:54:05.140684', 1, 'PAGADO');
INSERT INTO public.pagos (id_pago, id_alumno, id_preticket, id_pension, id_concepto, monto, forma_pago, nro_operacion, fecha_pago, id_usuario_cobrador, estado) VALUES (8, 14, NULL, NULL, 9, 250.00, 'Efectivo', 'OP-12345', '2026-10-13 00:11:53.36153', 2, 'PAGADO');
INSERT INTO public.pagos (id_pago, id_alumno, id_preticket, id_pension, id_concepto, monto, forma_pago, nro_operacion, fecha_pago, id_usuario_cobrador, estado) VALUES (9, 14, NULL, NULL, 9, 250.00, 'Efectivo', 'OP-123456', '2026-10-13 00:12:50.411623', 2, 'PAGADO');
INSERT INTO public.pagos (id_pago, id_alumno, id_preticket, id_pension, id_concepto, monto, forma_pago, nro_operacion, fecha_pago, id_usuario_cobrador, estado) VALUES (10, 14, NULL, NULL, 10, 250.00, 'Efectivo', '123', '2026-10-13 00:30:56.425646', 2, 'PAGADO');
INSERT INTO public.pagos (id_pago, id_alumno, id_preticket, id_pension, id_concepto, monto, forma_pago, nro_operacion, fecha_pago, id_usuario_cobrador, estado) VALUES (11, 14, NULL, 139, 10, 250.00, 'Efectivo', 'OP-99999', '2026-10-13 00:37:34.562802', 2, 'PAGADO');


--
-- Data for Name: pensiones; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (1, 1, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (2, 1, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (3, 1, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (4, 1, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (5, 1, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (6, 1, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (7, 1, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (8, 1, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (9, 1, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (10, 1, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (11, 2, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (12, 2, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (13, 2, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (14, 2, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (15, 2, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (16, 2, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (17, 2, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (18, 2, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (19, 2, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (20, 2, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (21, 3, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (22, 3, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (23, 3, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (24, 3, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (25, 3, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (26, 3, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (27, 3, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (28, 3, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (29, 3, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (30, 3, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (31, 4, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (32, 4, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (33, 4, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (34, 4, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (35, 4, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (36, 4, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (37, 4, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (38, 4, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (39, 4, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (40, 4, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (41, 5, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (42, 5, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (43, 5, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (44, 5, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (45, 5, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (46, 5, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (47, 5, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (48, 5, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (49, 5, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (50, 5, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (51, 6, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (52, 6, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (53, 6, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (54, 6, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (55, 6, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (56, 6, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (57, 6, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (58, 6, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (59, 6, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (60, 6, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (61, 7, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (62, 7, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (63, 7, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (64, 7, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (65, 7, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (66, 7, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (67, 7, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (68, 7, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (69, 7, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (70, 7, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (71, 8, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (72, 8, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (73, 8, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (74, 8, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (75, 8, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (76, 8, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (77, 8, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (78, 8, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (79, 8, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (80, 8, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (81, 9, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (82, 9, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (83, 9, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (84, 9, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (85, 9, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (86, 9, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (87, 9, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (88, 9, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (89, 9, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (90, 9, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (91, 10, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (92, 10, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (93, 10, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (94, 10, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (95, 10, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (96, 10, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (97, 10, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (98, 10, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (99, 10, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (100, 10, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (101, 11, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (102, 11, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (103, 11, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (104, 11, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (105, 11, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (106, 11, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (107, 11, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (108, 11, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (109, 11, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (110, 11, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (111, 12, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (112, 12, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (113, 12, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (114, 12, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (115, 12, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (116, 12, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (117, 12, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (118, 12, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (119, 12, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (120, 12, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (121, 13, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (122, 13, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (123, 13, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (124, 13, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (125, 13, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (126, 13, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (127, 13, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (128, 13, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (129, 13, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (130, 13, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (131, 14, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (132, 14, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (133, 14, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (134, 14, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (135, 14, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (136, 14, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (137, 14, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (138, 14, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (140, 14, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (141, 15, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (142, 15, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (143, 15, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (144, 15, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (145, 15, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (146, 15, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (147, 15, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (148, 15, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (149, 15, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (150, 15, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (151, 16, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (152, 16, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (153, 16, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (154, 16, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (155, 16, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (156, 16, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (157, 16, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (158, 16, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (159, 16, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (160, 16, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (161, 17, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (162, 17, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (163, 17, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (164, 17, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (165, 17, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (166, 17, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (167, 17, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (168, 17, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (169, 17, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (170, 17, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (171, 18, 2026, 3, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (172, 18, 2026, 4, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (173, 18, 2026, 5, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (174, 18, 2026, 6, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (175, 18, 2026, 7, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (176, 18, 2026, 8, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (177, 18, 2026, 9, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (178, 18, 2026, 10, 250.00, 0.00, 250.00, 'PAGADO', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (179, 18, 2026, 11, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (180, 18, 2026, 12, 250.00, 0.00, 250.00, 'PENDIENTE', NULL);
INSERT INTO public.pensiones (id_pension, id_alumno, anio_lectivo, mes, monto_base, descuento, monto_final, estado, id_beca) VALUES (139, 14, 2026, 11, 250.00, 0.00, 250.00, 'PAGADO', NULL);


--
-- Data for Name: personal; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.personal (id_personal, id_usuario, especialidad, cargo, fecha_ingreso, fecha_cese, motivo_cese) VALUES (1, 2, 'Auxiliar Administrativo', 'Secretaría/Tesorería', '2024-03-01', NULL, NULL);
INSERT INTO public.personal (id_personal, id_usuario, especialidad, cargo, fecha_ingreso, fecha_cese, motivo_cese) VALUES (2, 3, 'Lic. Educación - Matemáticas', 'Docente de Matemática', '2020-03-01', NULL, NULL);
INSERT INTO public.personal (id_personal, id_usuario, especialidad, cargo, fecha_ingreso, fecha_cese, motivo_cese) VALUES (3, 4, 'Lic. Educación - Ciencias Sociales', 'Docente de Sociales', '2021-03-01', NULL, NULL);
INSERT INTO public.personal (id_personal, id_usuario, especialidad, cargo, fecha_ingreso, fecha_cese, motivo_cese) VALUES (5, 6, 'Lic. Educación - Lenguaje', 'Docente de Comunicación', '2022-03-01', NULL, NULL);
INSERT INTO public.personal (id_personal, id_usuario, especialidad, cargo, fecha_ingreso, fecha_cese, motivo_cese) VALUES (6, 27, 'Lic. Artes', 'Docente de Musica', '2026-10-13', '2026-10-13', 'Término de Contrato');
INSERT INTO public.personal (id_personal, id_usuario, especialidad, cargo, fecha_ingreso, fecha_cese, motivo_cese) VALUES (7, 28, 'Lic Prueba', 'Docente de prueba', '2026-10-13', NULL, NULL);
INSERT INTO public.personal (id_personal, id_usuario, especialidad, cargo, fecha_ingreso, fecha_cese, motivo_cese) VALUES (4, 5, 'Lic. Educación - Ciencias Naturales', 'Docente de Ciencias', '2019-03-01', NULL, NULL);


--
-- Data for Name: pre_tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.pre_tickets (id_preticket, id_alumno, id_concepto, monto, estado, fecha_emision, fecha_pago, id_usuario_emite) VALUES (1, 1, 1, 250.00, 'PENDIENTE', '2026-10-12 13:52:44.34357', NULL, 2);


--
-- Data for Name: recuperacion_password; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.recuperacion_password (id_recuperacion, id_usuario, token, fecha_solicitud, fecha_expiracion, usado) VALUES (1, 6, '4d004d359e1ed6624f532dc64fb7f1fabbd2824566c605b8b4e326a61b5aa091', '2026-10-13 15:40:19.505638', '2026-10-13 17:40:19.499', true);
INSERT INTO public.recuperacion_password (id_recuperacion, id_usuario, token, fecha_solicitud, fecha_expiracion, usado) VALUES (2, 6, 'ad7ffdeacba64e73c924a88ce19b2944bae58122f328f3c2a90b11f1bd15309c', '2026-10-13 15:45:55.729543', '2026-10-13 17:45:55.719', true);


--
-- Data for Name: resumen_asistencia_curso; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.roles (id_rol, nombre_rol, descripcion, fecha_creacion) VALUES (1, 'ADMIN', 'Administrador General del sistema', '2026-10-12 13:52:44.34357');
INSERT INTO public.roles (id_rol, nombre_rol, descripcion, fecha_creacion) VALUES (2, 'DOCENTE', 'Docente de aula', '2026-10-12 13:52:44.34357');
INSERT INTO public.roles (id_rol, nombre_rol, descripcion, fecha_creacion) VALUES (3, 'SECRETARIA', 'Secretaría y Tesorería', '2026-10-12 13:52:44.34357');
INSERT INTO public.roles (id_rol, nombre_rol, descripcion, fecha_creacion) VALUES (4, 'ESTUDIANTE', 'Estudiante matriculado', '2026-10-12 13:52:44.34357');


--
-- Data for Name: tutores_grado; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.tutores_grado (id_tutor, id_grado, id_personal, anio_lectivo) VALUES (2, 2, 2, 2026);
INSERT INTO public.tutores_grado (id_tutor, id_grado, id_personal, anio_lectivo) VALUES (3, 3, 5, 2026);
INSERT INTO public.tutores_grado (id_tutor, id_grado, id_personal, anio_lectivo) VALUES (4, 4, 4, 2026);
INSERT INTO public.tutores_grado (id_tutor, id_grado, id_personal, anio_lectivo) VALUES (5, 5, 3, 2026);
INSERT INTO public.tutores_grado (id_tutor, id_grado, id_personal, anio_lectivo) VALUES (6, 1, 4, 2026);


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (9, '76829401', 'Yazid Ismael', 'Suárez Quispe', 'ysuarez@unioncientifica.edu.pe', '$2a$10$H.pimFFN55pxFp3LfjMZc.u.beWz5Ob3CZ3tZ/izAAW86adhxGrcK', '951234876', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (10, '70000001', 'Luis', 'García', 'luis.garcía1@unioncientifica.edu.pe', '$2a$10$IHv5bnuq3Z7zJeEWQneHK.T.llDeJTabI0kWebMJnMZ2./bjyyURS', '910000001', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (11, '70000002', 'Ana', 'Rodríguez', 'ana.rodríguez2@unioncientifica.edu.pe', '$2a$10$ZAaFTZ/EpatGK2KjYsR.auXK.PZn4sNmS.xTT5QMj.zTeMrNDrE/G', '910000002', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (12, '70000003', 'Diego', 'Martínez', 'diego.martínez3@unioncientifica.edu.pe', '$2a$10$MCPfJYvhkEwrZ22VnHa3Ce.ibICoXGp3DT.Z3sjD5Sh0SYvmuqLN2', '910000003', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (13, '70000004', 'Sofía', 'López', 'sofía.lópez4@unioncientifica.edu.pe', '$2a$10$B.LHJQPRFX1FWVSL6oz7uOatKxIP7yYv3q2K4iCxfnbJbcuG.cJTy', '910000004', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (14, '70000005', 'Mateo', 'González', 'mateo.gonzález5@unioncientifica.edu.pe', '$2a$10$Ia/vFsg2ccx1D6R4xsXW3.ryMcTZzQ9DFQ6vWaCJReHf7rQc5FiFS', '910000005', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (15, '70000006', 'Valeria', 'Hernández', 'valeria.hernández6@unioncientifica.edu.pe', '$2a$10$r8OiM9P8yL9vu49cRBMAHOIkBN7J9RXE7iHw.ByqSZh9UqqZj0PWa', '910000006', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (16, '70000007', 'Sebastián', 'Pérez', 'sebastián.pérez7@unioncientifica.edu.pe', '$2a$10$./CE.K7aWf2N4KgVl.T51OXN9SU.3Ba0ygeuK9Y5yF1mAy4b5J9Dy', '910000007', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (17, '70000008', 'Camila', 'Sánchez', 'camila.sánchez8@unioncientifica.edu.pe', '$2a$10$6B3poihaWOgeWq2sjg3wqe7.wTYJh8Gut/GQSGAW/VU3mi/mF.5K2', '910000008', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (18, '70000009', 'Andrés', 'Ramírez', 'andrés.ramírez9@unioncientifica.edu.pe', '$2a$10$vir5k4fJ38ZSHUkzFzWR5ebzFdWmsy31uNr4nvUhPHT00sw58YteO', '910000009', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (19, '70000010', 'Daniela', 'Torres', 'daniela.torres10@unioncientifica.edu.pe', '$2a$10$2cptP511DsU.BjAM6fmwXucqhL2Pbdf9wDUCjX5a/BAXfZfIuVVlK', '910000010', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (21, '70000012', 'Fernanda', 'Rivera', 'fernanda.rivera12@unioncientifica.edu.pe', '$2a$10$Rd8tvBVb.eJZUFpvR4XAkOXzua4t3wvX2Q1525E/2YJruxIBCUloS', '910000012', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (22, '70000013', 'Gabriel', 'Gómez', 'gabriel.gómez13@unioncientifica.edu.pe', '$2a$10$tYXnU3qkoUd8m2bGNAoZbO9zJJ9I2devMnjUeQe.ySaJgS1FL7wRW', '910000013', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (23, '70000014', 'Isabella', 'Díaz', 'isabella.díaz14@unioncientifica.edu.pe', '$2a$10$lFjtY2Cm6tiX5ZhlQtidvuuuFWIcVs/gAu./g2rnecSo3O/rjgZKe', '910000014', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (24, '70000015', 'Adrián', 'Vargas', 'adrián.vargas15@unioncientifica.edu.pe', '$2a$10$hEWjXXI0SapVjLvBRHxhR.7B3auVvttKKylTsMj869DPO1oeP4iGO', '910000015', 4, 'ACTIVO', false, NULL, '2026-10-12 13:52:44.34357', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (6, '50182736', 'Anel Adela', 'Aguilar Rojas', 'aaguilar@unioncientifica.edu.pe', '$2a$10$4bvkg5jfO2L2R5f7z7Z5X.pt4F8VoTzle5CUROafpRuFhhjdwh/LS', '986333445', 2, 'ACTIVO', false, '2026-10-13 15:47:28.799825', '2026-10-12 13:52:44.34357', '2026-10-13 15:47:28.799825', 'yarolbellocoquil@gmail.com');
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (5, '30192847', 'Giancarlo', 'Vilchez Rojas', 'gvilchez@unioncientifica.edu.pe', '$2a$10$jJqL3gcBTFRKQ8DGj7yFoOn8BuL4UdAr.Hl9b7Eu7kvbzJlql1U52', '987111222', 2, 'ACTIVO', false, '2026-10-13 16:11:29.991545', '2026-10-12 13:52:44.34357', '2026-10-13 16:11:29.991545', 'yarolbellocoquil@gmail.com');
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (25, '78945612', 'Ana Lucía', 'Flores Quispe', 'analucía.floresquispe@unioncientifica.edu.pe', '$2a$10$gIBGcz5By61R6C1grQSNNezDYCpo58.1dN8iRoNLwNTTRfEgFGa6q', NULL, 4, 'ACTIVO', false, NULL, '2026-10-12 19:16:56.9649', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (8, '74829103', 'Renato Mijael', 'Velasque Pocco', 'rvelasque@unioncientifica.edu.pe', '$2a$10$/AO3NS9J0F4A/V/hggvrRugIcLY4MyLKBuZ9VXwfd7gG0xh8/zKGq', '983686131', 4, 'ACTIVO', false, '2026-10-13 15:38:16.352741', '2026-10-12 13:52:44.34357', '2026-10-13 15:38:16.352741', 'yarolbellocoquil@gmail.com');
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (3, '10293847', 'Juan Carlos', 'Pérez Huamán', 'jperez@unioncientifica.edu.pe', '$2a$10$OcJDroiUZD69hW49RFIjEOz1qE6mYDchJxw.KPxHNZCCX/1jYP23a', '987654321', 2, 'ACTIVO', true, '2026-10-13 13:50:33.450469', '2026-10-12 13:52:44.34357', '2026-10-13 13:56:28.023368', 'yarolbellocoquil@gmail.com');
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (26, '98877665', 'Pedro Pablo', 'Sánchez López', 'pedropablo.sánchezlópez@unioncientifica.edu.pe', '$2a$10$7ECvOk9kTovMIwuJfEVqhutnS6fYlsW9.Tci0048DQV7aSWFJir6e', NULL, 4, 'ACTIVO', false, NULL, '2026-10-12 22:57:24.001138', NULL, NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (20, '70000011', 'Rodrigo', 'Flores', 'rodrigo.flores11@unioncientifica.edu.pe', '$2a$10$kPay98ThkvnjF3hDwW65puJqYPQTRhBH8fDwtnuQ09eHo0AiIj9Y2', '910000011', 4, 'ACTIVO', true, NULL, '2026-10-12 13:52:44.34357', '2026-10-12 23:17:56.85503', NULL);
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (7, '75918234', 'Anel Adela', 'Palomino Rojas', 'apalomino@unioncientifica.edu.pe', '$2a$10$U9z9gVGiDX8kfW64/JTVkOf99Cg.jxgFeAFY0Jw0vsDPPn8hjMM0S', '964123456', 4, 'ACTIVO', false, '2026-10-13 15:38:38.196877', '2026-10-12 13:52:44.34357', '2026-10-13 15:38:38.196877', 'yarolbellocoquil@gmail.com');
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (29, '56784321', 'Alumno', 'Test', 'alumno.test@unioncientifica.edu.pe', '$2a$10$Jzz.WodpLELmTYriPbLOCOuzbNJ1b6IFo6rpNw/JOU6mM8o7i2IV2', NULL, 4, 'ACTIVO', false, NULL, '2026-10-13 13:39:29.36017', NULL, 'yarolcontacto@gmail.com');
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (27, '19873022', 'Berna', 'Coquil Laura', 'berna@unioncientifica.edu.pe', '$2a$10$XrZ0b5scXGhdXoxXnWkTXuEwrSXAXnZiVTpb.y6I0CYoDJ1TqmMBS', '982802534', 2, 'CESADO', false, NULL, '2026-10-13 09:19:42.855695', '2026-10-13 13:43:55.510766', 'yarolbellocoquil@gmail.com');
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (2, '40596837', 'Sofia Patricia', 'Vargas Luna', 'svargas@unioncientifica.edu.pe', '$2a$10$DO9gODfGbU0VAe3w3yGezeNaf4sY0AnklXp6gY52E4q1.Qwcx2VyO', '954123876', 3, 'ACTIVO', false, '2026-10-13 11:05:21.624851', '2026-10-12 13:52:44.34357', '2026-10-13 13:43:55.510766', 'yarolbellocoquil@gmail.com');
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (4, '20394812', 'Ricardo Manuel', 'Gómez Torres', 'rgomez@unioncientifica.edu.pe', '$2a$10$MhWQwfIagtYYpcNdIIBx.uAGXgfSwxj2RhR1RO0AKGrARnWbcD8Uq', '912345678', 2, 'ACTIVO', false, '2026-10-13 12:56:40.937625', '2026-10-12 13:52:44.34357', '2026-10-13 13:43:55.510766', 'yarolbellocoquil@gmail.com');
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (28, '56781234', 'Test', 'Prueba', 'test.prueba@unioncientifica.edu.pe', '$2a$10$3H3k9J3FlAs7F6QLrq33ROypalYUMAsznTRUhGACMxM3/JB.gfDnO', '999111222', 2, 'ACTIVO', false, NULL, '2026-10-13 13:37:42.722956', '2026-10-13 13:43:55.510766', 'yarolbellocoquil@gmail.com');
INSERT INTO public.usuarios (id_usuario, dni, nombres, apellidos, correo_institucional, password_hash, telefono, id_rol, estado, requiere_cambio_password, ultimo_login, fecha_creacion, fecha_actualizacion, correo_personal) VALUES (1, '74829102', 'Yarol', 'Bello Coquil', 'ybello@unioncientifica.edu.pe', '$2a$10$ttrMHmaEjFxIWvzAXBi2L.BMXpaNh3wSUAKs9uFOB.2r/CSz9sMxK', '964821039', 1, 'ACTIVO', false, '2026-10-13 16:10:32.760639', '2026-10-12 13:52:44.34357', '2026-10-13 16:10:32.760639', 'yarolbellocoquil@gmail.com');


--
-- Name: actas_bimestrales_id_acta_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.actas_bimestrales_id_acta_seq', 2, true);


--
-- Name: alumnos_id_alumno_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.alumnos_id_alumno_seq', 21, true);


--
-- Name: alumnos_riesgo_id_riesgo_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.alumnos_riesgo_id_riesgo_seq', 1, false);


--
-- Name: aperturas_caja_id_apertura_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.aperturas_caja_id_apertura_seq', 2, true);


--
-- Name: apoderados_id_apoderado_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.apoderados_id_apoderado_seq', 11, true);


--
-- Name: asistencia_alumnos_id_asistencia_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.asistencia_alumnos_id_asistencia_seq', 14, true);


--
-- Name: asistencia_personal_id_asistencia_personal_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.asistencia_personal_id_asistencia_personal_seq', 2, true);


--
-- Name: becas_id_beca_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.becas_id_beca_seq', 2, true);


--
-- Name: bitacora_auditoria_id_bitacora_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bitacora_auditoria_id_bitacora_seq', 8, true);


--
-- Name: boletas_electronicas_id_boleta_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.boletas_electronicas_id_boleta_seq', 10, true);


--
-- Name: cajas_id_caja_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cajas_id_caja_seq', 1, true);


--
-- Name: calificaciones_id_calificacion_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.calificaciones_id_calificacion_seq', 5, true);


--
-- Name: carga_curricular_id_carga_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.carga_curricular_id_carga_seq', 60, true);


--
-- Name: cierres_caja_id_cierre_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cierres_caja_id_cierre_seq', 2, true);


--
-- Name: competencias_id_competencia_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.competencias_id_competencia_seq', 29, true);


--
-- Name: conceptos_pago_id_concepto_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conceptos_pago_id_concepto_seq', 11, true);


--
-- Name: conclusiones_descriptivas_id_conclusion_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conclusiones_descriptivas_id_conclusion_seq', 1, true);


--
-- Name: credenciales_qr_id_credencial_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.credenciales_qr_id_credencial_seq', 29, true);


--
-- Name: cuadro_merito_id_cuadro_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cuadro_merito_id_cuadro_seq', 1, false);


--
-- Name: cursos_id_curso_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cursos_id_curso_seq', 11, true);


--
-- Name: escala_calificacion_id_escala_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.escala_calificacion_id_escala_seq', 4, true);


--
-- Name: estado_carga_docentes_id_estado_carga_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.estado_carga_docentes_id_estado_carga_seq', 1, false);


--
-- Name: expediente_alumno_id_expediente_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.expediente_alumno_id_expediente_seq', 21, true);


--
-- Name: exportaciones_siagie_id_exportacion_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exportaciones_siagie_id_exportacion_seq', 4, true);


--
-- Name: grados_id_grado_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.grados_id_grado_seq', 5, true);


--
-- Name: horarios_id_horario_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.horarios_id_horario_seq', 13, true);


--
-- Name: libretas_id_libreta_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.libretas_id_libreta_seq', 1, false);


--
-- Name: movimientos_caja_id_movimiento_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.movimientos_caja_id_movimiento_seq', 10, true);


--
-- Name: notas_finales_area_id_nota_final_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notas_finales_area_id_nota_final_seq', 2, true);


--
-- Name: notificaciones_id_notificacion_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notificaciones_id_notificacion_seq', 8, true);


--
-- Name: pagos_id_pago_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pagos_id_pago_seq', 11, true);


--
-- Name: pensiones_id_pension_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pensiones_id_pension_seq', 180, true);


--
-- Name: personal_id_personal_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.personal_id_personal_seq', 7, true);


--
-- Name: pre_tickets_id_preticket_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pre_tickets_id_preticket_seq', 1, true);


--
-- Name: recuperacion_password_id_recuperacion_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.recuperacion_password_id_recuperacion_seq', 2, true);


--
-- Name: resumen_asistencia_curso_id_resumen_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.resumen_asistencia_curso_id_resumen_seq', 1, false);


--
-- Name: roles_id_rol_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_rol_seq', 4, true);


--
-- Name: tutores_grado_id_tutor_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tutores_grado_id_tutor_seq', 6, true);


--
-- Name: usuarios_id_usuario_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuarios_id_usuario_seq', 29, true);


--
-- Name: actas_bimestrales actas_bimestrales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actas_bimestrales
    ADD CONSTRAINT actas_bimestrales_pkey PRIMARY KEY (id_acta);


--
-- Name: alumnos alumnos_codigo_estudiante_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_codigo_estudiante_key UNIQUE (codigo_estudiante);


--
-- Name: alumnos alumnos_dni_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_dni_key UNIQUE (dni);


--
-- Name: alumnos alumnos_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_id_usuario_key UNIQUE (id_usuario);


--
-- Name: alumnos alumnos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_pkey PRIMARY KEY (id_alumno);


--
-- Name: alumnos_riesgo alumnos_riesgo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_riesgo
    ADD CONSTRAINT alumnos_riesgo_pkey PRIMARY KEY (id_riesgo);


--
-- Name: aperturas_caja aperturas_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aperturas_caja
    ADD CONSTRAINT aperturas_caja_pkey PRIMARY KEY (id_apertura);


--
-- Name: apoderados apoderados_dni_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apoderados
    ADD CONSTRAINT apoderados_dni_key UNIQUE (dni);


--
-- Name: apoderados apoderados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.apoderados
    ADD CONSTRAINT apoderados_pkey PRIMARY KEY (id_apoderado);


--
-- Name: asistencia_alumnos asistencia_alumnos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos
    ADD CONSTRAINT asistencia_alumnos_pkey PRIMARY KEY (id_asistencia);


--
-- Name: asistencia_personal asistencia_personal_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_personal
    ADD CONSTRAINT asistencia_personal_pkey PRIMARY KEY (id_asistencia_personal);


--
-- Name: becas becas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.becas
    ADD CONSTRAINT becas_pkey PRIMARY KEY (id_beca);


--
-- Name: bitacora_auditoria bitacora_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bitacora_auditoria
    ADD CONSTRAINT bitacora_auditoria_pkey PRIMARY KEY (id_bitacora);


--
-- Name: boletas_electronicas boletas_electronicas_numero_boleta_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boletas_electronicas
    ADD CONSTRAINT boletas_electronicas_numero_boleta_key UNIQUE (numero_boleta);


--
-- Name: boletas_electronicas boletas_electronicas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boletas_electronicas
    ADD CONSTRAINT boletas_electronicas_pkey PRIMARY KEY (id_boleta);


--
-- Name: cajas cajas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cajas
    ADD CONSTRAINT cajas_pkey PRIMARY KEY (id_caja);


--
-- Name: calificaciones calificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_pkey PRIMARY KEY (id_calificacion);


--
-- Name: carga_curricular carga_curricular_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carga_curricular
    ADD CONSTRAINT carga_curricular_pkey PRIMARY KEY (id_carga);


--
-- Name: cierres_caja cierres_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierres_caja
    ADD CONSTRAINT cierres_caja_pkey PRIMARY KEY (id_cierre);


--
-- Name: competencias competencias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT competencias_pkey PRIMARY KEY (id_competencia);


--
-- Name: conceptos_pago conceptos_pago_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conceptos_pago
    ADD CONSTRAINT conceptos_pago_pkey PRIMARY KEY (id_concepto);


--
-- Name: conclusiones_descriptivas conclusiones_descriptivas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conclusiones_descriptivas
    ADD CONSTRAINT conclusiones_descriptivas_pkey PRIMARY KEY (id_conclusion);


--
-- Name: credenciales_qr credenciales_qr_codigo_qr_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credenciales_qr
    ADD CONSTRAINT credenciales_qr_codigo_qr_key UNIQUE (codigo_qr);


--
-- Name: credenciales_qr credenciales_qr_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credenciales_qr
    ADD CONSTRAINT credenciales_qr_id_usuario_key UNIQUE (id_usuario);


--
-- Name: credenciales_qr credenciales_qr_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credenciales_qr
    ADD CONSTRAINT credenciales_qr_pkey PRIMARY KEY (id_credencial);


--
-- Name: cuadro_merito cuadro_merito_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadro_merito
    ADD CONSTRAINT cuadro_merito_pkey PRIMARY KEY (id_cuadro);


--
-- Name: cursos cursos_nombre_curso_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cursos
    ADD CONSTRAINT cursos_nombre_curso_key UNIQUE (nombre_curso);


--
-- Name: cursos cursos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cursos
    ADD CONSTRAINT cursos_pkey PRIMARY KEY (id_curso);


--
-- Name: escala_calificacion escala_calificacion_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escala_calificacion
    ADD CONSTRAINT escala_calificacion_codigo_key UNIQUE (codigo);


--
-- Name: escala_calificacion escala_calificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.escala_calificacion
    ADD CONSTRAINT escala_calificacion_pkey PRIMARY KEY (id_escala);


--
-- Name: estado_carga_docentes estado_carga_docentes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado_carga_docentes
    ADD CONSTRAINT estado_carga_docentes_pkey PRIMARY KEY (id_estado_carga);


--
-- Name: expediente_alumno expediente_alumno_id_alumno_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expediente_alumno
    ADD CONSTRAINT expediente_alumno_id_alumno_key UNIQUE (id_alumno);


--
-- Name: expediente_alumno expediente_alumno_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expediente_alumno
    ADD CONSTRAINT expediente_alumno_pkey PRIMARY KEY (id_expediente);


--
-- Name: exportaciones_siagie exportaciones_siagie_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exportaciones_siagie
    ADD CONSTRAINT exportaciones_siagie_pkey PRIMARY KEY (id_exportacion);


--
-- Name: grados grados_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grados
    ADD CONSTRAINT grados_pkey PRIMARY KEY (id_grado);


--
-- Name: horarios horarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_pkey PRIMARY KEY (id_horario);


--
-- Name: libretas libretas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.libretas
    ADD CONSTRAINT libretas_pkey PRIMARY KEY (id_libreta);


--
-- Name: movimientos_caja movimientos_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_pkey PRIMARY KEY (id_movimiento);


--
-- Name: notas_finales_area notas_finales_area_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_finales_area
    ADD CONSTRAINT notas_finales_area_pkey PRIMARY KEY (id_nota_final);


--
-- Name: notificaciones notificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_pkey PRIMARY KEY (id_notificacion);


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id_pago);


--
-- Name: pensiones pensiones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pensiones
    ADD CONSTRAINT pensiones_pkey PRIMARY KEY (id_pension);


--
-- Name: personal personal_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_id_usuario_key UNIQUE (id_usuario);


--
-- Name: personal personal_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_pkey PRIMARY KEY (id_personal);


--
-- Name: pre_tickets pre_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pre_tickets
    ADD CONSTRAINT pre_tickets_pkey PRIMARY KEY (id_preticket);


--
-- Name: recuperacion_password recuperacion_password_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recuperacion_password
    ADD CONSTRAINT recuperacion_password_pkey PRIMARY KEY (id_recuperacion);


--
-- Name: recuperacion_password recuperacion_password_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recuperacion_password
    ADD CONSTRAINT recuperacion_password_token_key UNIQUE (token);


--
-- Name: resumen_asistencia_curso resumen_asistencia_curso_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumen_asistencia_curso
    ADD CONSTRAINT resumen_asistencia_curso_pkey PRIMARY KEY (id_resumen);


--
-- Name: roles roles_nombre_rol_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_nombre_rol_key UNIQUE (nombre_rol);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id_rol);


--
-- Name: tutores_grado tutores_grado_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tutores_grado
    ADD CONSTRAINT tutores_grado_pkey PRIMARY KEY (id_tutor);


--
-- Name: asistencia_alumnos uq_asistencia_dia; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos
    ADD CONSTRAINT uq_asistencia_dia UNIQUE (id_alumno, id_curso, fecha);


--
-- Name: asistencia_personal uq_asistencia_personal_dia; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_personal
    ADD CONSTRAINT uq_asistencia_personal_dia UNIQUE (id_personal, fecha);


--
-- Name: calificaciones uq_calificacion; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT uq_calificacion UNIQUE (id_alumno, id_curso, id_competencia, bimestre, anio_lectivo);


--
-- Name: carga_curricular uq_carga_curricular; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carga_curricular
    ADD CONSTRAINT uq_carga_curricular UNIQUE (id_grado, id_curso, anio_lectivo);


--
-- Name: conclusiones_descriptivas uq_conclusion; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conclusiones_descriptivas
    ADD CONSTRAINT uq_conclusion UNIQUE (id_alumno, id_curso, bimestre, anio_lectivo);


--
-- Name: cuadro_merito uq_cuadro; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadro_merito
    ADD CONSTRAINT uq_cuadro UNIQUE (id_alumno, bimestre, anio_lectivo);


--
-- Name: grados uq_grado; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grados
    ADD CONSTRAINT uq_grado UNIQUE (nombre_grado, seccion, anio_lectivo);


--
-- Name: libretas uq_libreta; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.libretas
    ADD CONSTRAINT uq_libreta UNIQUE (id_alumno, bimestre, anio_lectivo);


--
-- Name: notas_finales_area uq_nota_final; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_finales_area
    ADD CONSTRAINT uq_nota_final UNIQUE (id_alumno, id_curso, bimestre, anio_lectivo);


--
-- Name: pensiones uq_pension; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pensiones
    ADD CONSTRAINT uq_pension UNIQUE (id_alumno, anio_lectivo, mes);


--
-- Name: resumen_asistencia_curso uq_resumen; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumen_asistencia_curso
    ADD CONSTRAINT uq_resumen UNIQUE (id_alumno, id_curso);


--
-- Name: alumnos_riesgo uq_riesgo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_riesgo
    ADD CONSTRAINT uq_riesgo UNIQUE (id_alumno, bimestre);


--
-- Name: tutores_grado uq_tutor_grado; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tutores_grado
    ADD CONSTRAINT uq_tutor_grado UNIQUE (id_grado, anio_lectivo);


--
-- Name: usuarios usuarios_correo_institucional_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_correo_institucional_key UNIQUE (correo_institucional);


--
-- Name: usuarios usuarios_dni_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_dni_key UNIQUE (dni);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario);


--
-- Name: idx_alumnos_anio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alumnos_anio ON public.alumnos USING btree (anio_lectivo);


--
-- Name: idx_alumnos_dni; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alumnos_dni ON public.alumnos USING btree (dni);


--
-- Name: idx_alumnos_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alumnos_estado ON public.alumnos USING btree (estado_matricula);


--
-- Name: idx_alumnos_grado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_alumnos_grado ON public.alumnos USING btree (id_grado);


--
-- Name: idx_asistencia_alumno; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencia_alumno ON public.asistencia_alumnos USING btree (id_alumno);


--
-- Name: idx_asistencia_curso; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencia_curso ON public.asistencia_alumnos USING btree (id_curso, fecha);


--
-- Name: idx_asistencia_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencia_fecha ON public.asistencia_alumnos USING btree (fecha);


--
-- Name: idx_asistencia_personal_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asistencia_personal_fecha ON public.asistencia_personal USING btree (fecha);


--
-- Name: idx_bitacora_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bitacora_fecha ON public.bitacora_auditoria USING btree (fecha_hora);


--
-- Name: idx_bitacora_modulo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bitacora_modulo ON public.bitacora_auditoria USING btree (modulo_afectado);


--
-- Name: idx_bitacora_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bitacora_usuario ON public.bitacora_auditoria USING btree (id_usuario);


--
-- Name: idx_calif_alumno_curso; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calif_alumno_curso ON public.calificaciones USING btree (id_alumno, id_curso);


--
-- Name: idx_calif_bimestre; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calif_bimestre ON public.calificaciones USING btree (bimestre, anio_lectivo);


--
-- Name: idx_carga_docente; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_carga_docente ON public.carga_curricular USING btree (id_personal);


--
-- Name: idx_competencias_curso; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_competencias_curso ON public.competencias USING btree (id_curso);


--
-- Name: idx_grados_anio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_grados_anio ON public.grados USING btree (anio_lectivo);


--
-- Name: idx_horario_grado_dia; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_horario_grado_dia ON public.horarios USING btree (id_grado, dia_semana);


--
-- Name: idx_notif_destino; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notif_destino ON public.notificaciones USING btree (id_usuario_destino, leido);


--
-- Name: idx_pagos_alumno; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pagos_alumno ON public.pagos USING btree (id_alumno);


--
-- Name: idx_pagos_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pagos_fecha ON public.pagos USING btree (fecha_pago);


--
-- Name: idx_personal_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_personal_usuario ON public.personal USING btree (id_usuario);


--
-- Name: idx_recuperacion_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recuperacion_token ON public.recuperacion_password USING btree (token);


--
-- Name: idx_usuarios_correo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_correo ON public.usuarios USING btree (correo_institucional);


--
-- Name: idx_usuarios_dni; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_dni ON public.usuarios USING btree (dni);


--
-- Name: idx_usuarios_rol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_rol ON public.usuarios USING btree (id_rol);


--
-- Name: calificaciones trg_calificaciones_audit; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_calificaciones_audit AFTER INSERT OR UPDATE ON public.calificaciones FOR EACH ROW EXECUTE FUNCTION public.trg_auditar_calificacion();


--
-- Name: pagos trg_pagos_mov_caja; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_pagos_mov_caja AFTER INSERT ON public.pagos FOR EACH ROW EXECUTE FUNCTION public.trg_pago_a_caja();


--
-- Name: pagos trg_pagos_pension; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_pagos_pension AFTER INSERT ON public.pagos FOR EACH ROW EXECUTE FUNCTION public.trg_actualizar_pension();


--
-- Name: pagos trg_pagos_preticket; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_pagos_preticket AFTER INSERT ON public.pagos FOR EACH ROW EXECUTE FUNCTION public.trg_actualizar_preticket();


--
-- Name: usuarios trg_usuarios_actualizar; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_usuarios_actualizar BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.trg_actualizar_timestamp();


--
-- Name: actas_bimestrales actas_bimestrales_cerrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actas_bimestrales
    ADD CONSTRAINT actas_bimestrales_cerrado_por_fkey FOREIGN KEY (cerrado_por) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: actas_bimestrales actas_bimestrales_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actas_bimestrales
    ADD CONSTRAINT actas_bimestrales_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- Name: alumnos alumnos_id_apoderado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_id_apoderado_fkey FOREIGN KEY (id_apoderado) REFERENCES public.apoderados(id_apoderado) ON DELETE SET NULL;


--
-- Name: alumnos alumnos_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE SET NULL;


--
-- Name: alumnos alumnos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos
    ADD CONSTRAINT alumnos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- Name: alumnos_riesgo alumnos_riesgo_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_riesgo
    ADD CONSTRAINT alumnos_riesgo_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: alumnos_riesgo alumnos_riesgo_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_riesgo
    ADD CONSTRAINT alumnos_riesgo_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- Name: alumnos_riesgo alumnos_riesgo_id_tutor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alumnos_riesgo
    ADD CONSTRAINT alumnos_riesgo_id_tutor_fkey FOREIGN KEY (id_tutor) REFERENCES public.personal(id_personal) ON DELETE SET NULL;


--
-- Name: aperturas_caja aperturas_caja_id_caja_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aperturas_caja
    ADD CONSTRAINT aperturas_caja_id_caja_fkey FOREIGN KEY (id_caja) REFERENCES public.cajas(id_caja) ON DELETE CASCADE;


--
-- Name: aperturas_caja aperturas_caja_id_usuario_apertura_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aperturas_caja
    ADD CONSTRAINT aperturas_caja_id_usuario_apertura_fkey FOREIGN KEY (id_usuario_apertura) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: asistencia_alumnos asistencia_alumnos_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos
    ADD CONSTRAINT asistencia_alumnos_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: asistencia_alumnos asistencia_alumnos_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos
    ADD CONSTRAINT asistencia_alumnos_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- Name: asistencia_alumnos asistencia_alumnos_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos
    ADD CONSTRAINT asistencia_alumnos_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- Name: asistencia_alumnos asistencia_alumnos_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_alumnos
    ADD CONSTRAINT asistencia_alumnos_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE SET NULL;


--
-- Name: asistencia_personal asistencia_personal_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_personal
    ADD CONSTRAINT asistencia_personal_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE CASCADE;


--
-- Name: becas becas_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.becas
    ADD CONSTRAINT becas_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: bitacora_auditoria bitacora_auditoria_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bitacora_auditoria
    ADD CONSTRAINT bitacora_auditoria_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: boletas_electronicas boletas_electronicas_id_pago_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boletas_electronicas
    ADD CONSTRAINT boletas_electronicas_id_pago_fkey FOREIGN KEY (id_pago) REFERENCES public.pagos(id_pago) ON DELETE CASCADE;


--
-- Name: cajas cajas_responsable_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cajas
    ADD CONSTRAINT cajas_responsable_fkey FOREIGN KEY (responsable) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: calificaciones calificaciones_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: calificaciones calificaciones_id_competencia_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_id_competencia_fkey FOREIGN KEY (id_competencia) REFERENCES public.competencias(id_competencia) ON DELETE CASCADE;


--
-- Name: calificaciones calificaciones_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- Name: calificaciones calificaciones_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- Name: calificaciones calificaciones_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE SET NULL;


--
-- Name: calificaciones calificaciones_modificado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_modificado_por_fkey FOREIGN KEY (modificado_por) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: carga_curricular carga_curricular_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carga_curricular
    ADD CONSTRAINT carga_curricular_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- Name: carga_curricular carga_curricular_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carga_curricular
    ADD CONSTRAINT carga_curricular_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- Name: carga_curricular carga_curricular_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carga_curricular
    ADD CONSTRAINT carga_curricular_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE CASCADE;


--
-- Name: cierres_caja cierres_caja_id_apertura_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierres_caja
    ADD CONSTRAINT cierres_caja_id_apertura_fkey FOREIGN KEY (id_apertura) REFERENCES public.aperturas_caja(id_apertura) ON DELETE CASCADE;


--
-- Name: cierres_caja cierres_caja_id_usuario_cierre_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cierres_caja
    ADD CONSTRAINT cierres_caja_id_usuario_cierre_fkey FOREIGN KEY (id_usuario_cierre) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: competencias competencias_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competencias
    ADD CONSTRAINT competencias_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- Name: conclusiones_descriptivas conclusiones_descriptivas_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conclusiones_descriptivas
    ADD CONSTRAINT conclusiones_descriptivas_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: conclusiones_descriptivas conclusiones_descriptivas_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conclusiones_descriptivas
    ADD CONSTRAINT conclusiones_descriptivas_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- Name: conclusiones_descriptivas conclusiones_descriptivas_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conclusiones_descriptivas
    ADD CONSTRAINT conclusiones_descriptivas_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE SET NULL;


--
-- Name: credenciales_qr credenciales_qr_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credenciales_qr
    ADD CONSTRAINT credenciales_qr_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- Name: cuadro_merito cuadro_merito_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadro_merito
    ADD CONSTRAINT cuadro_merito_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: cuadro_merito cuadro_merito_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuadro_merito
    ADD CONSTRAINT cuadro_merito_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- Name: estado_carga_docentes estado_carga_docentes_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado_carga_docentes
    ADD CONSTRAINT estado_carga_docentes_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- Name: estado_carga_docentes estado_carga_docentes_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado_carga_docentes
    ADD CONSTRAINT estado_carga_docentes_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- Name: estado_carga_docentes estado_carga_docentes_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado_carga_docentes
    ADD CONSTRAINT estado_carga_docentes_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE CASCADE;


--
-- Name: expediente_alumno expediente_alumno_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expediente_alumno
    ADD CONSTRAINT expediente_alumno_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: exportaciones_siagie exportaciones_siagie_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exportaciones_siagie
    ADD CONSTRAINT exportaciones_siagie_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- Name: exportaciones_siagie exportaciones_siagie_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exportaciones_siagie
    ADD CONSTRAINT exportaciones_siagie_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: horarios horarios_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE SET NULL;


--
-- Name: horarios horarios_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- Name: horarios horarios_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT horarios_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE SET NULL;


--
-- Name: libretas libretas_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.libretas
    ADD CONSTRAINT libretas_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: libretas libretas_id_tutor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.libretas
    ADD CONSTRAINT libretas_id_tutor_fkey FOREIGN KEY (id_tutor) REFERENCES public.personal(id_personal) ON DELETE SET NULL;


--
-- Name: movimientos_caja movimientos_caja_id_apertura_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_id_apertura_fkey FOREIGN KEY (id_apertura) REFERENCES public.aperturas_caja(id_apertura) ON DELETE CASCADE;


--
-- Name: movimientos_caja movimientos_caja_id_pago_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_id_pago_fkey FOREIGN KEY (id_pago) REFERENCES public.pagos(id_pago) ON DELETE SET NULL;


--
-- Name: movimientos_caja movimientos_caja_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: notas_finales_area notas_finales_area_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_finales_area
    ADD CONSTRAINT notas_finales_area_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: notas_finales_area notas_finales_area_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notas_finales_area
    ADD CONSTRAINT notas_finales_area_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- Name: notificaciones notificaciones_id_usuario_destino_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_id_usuario_destino_fkey FOREIGN KEY (id_usuario_destino) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- Name: notificaciones notificaciones_id_usuario_remitente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notificaciones
    ADD CONSTRAINT notificaciones_id_usuario_remitente_fkey FOREIGN KEY (id_usuario_remitente) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: pagos pagos_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: pagos pagos_id_concepto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_concepto_fkey FOREIGN KEY (id_concepto) REFERENCES public.conceptos_pago(id_concepto) ON DELETE CASCADE;


--
-- Name: pagos pagos_id_pension_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_pension_fkey FOREIGN KEY (id_pension) REFERENCES public.pensiones(id_pension) ON DELETE SET NULL;


--
-- Name: pagos pagos_id_preticket_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_preticket_fkey FOREIGN KEY (id_preticket) REFERENCES public.pre_tickets(id_preticket) ON DELETE SET NULL;


--
-- Name: pagos pagos_id_usuario_cobrador_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_usuario_cobrador_fkey FOREIGN KEY (id_usuario_cobrador) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: pensiones pensiones_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pensiones
    ADD CONSTRAINT pensiones_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: pensiones pensiones_id_beca_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pensiones
    ADD CONSTRAINT pensiones_id_beca_fkey FOREIGN KEY (id_beca) REFERENCES public.becas(id_beca) ON DELETE SET NULL;


--
-- Name: personal personal_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal
    ADD CONSTRAINT personal_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- Name: pre_tickets pre_tickets_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pre_tickets
    ADD CONSTRAINT pre_tickets_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: pre_tickets pre_tickets_id_concepto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pre_tickets
    ADD CONSTRAINT pre_tickets_id_concepto_fkey FOREIGN KEY (id_concepto) REFERENCES public.conceptos_pago(id_concepto) ON DELETE CASCADE;


--
-- Name: pre_tickets pre_tickets_id_usuario_emite_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pre_tickets
    ADD CONSTRAINT pre_tickets_id_usuario_emite_fkey FOREIGN KEY (id_usuario_emite) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: recuperacion_password recuperacion_password_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recuperacion_password
    ADD CONSTRAINT recuperacion_password_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE;


--
-- Name: resumen_asistencia_curso resumen_asistencia_curso_id_alumno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumen_asistencia_curso
    ADD CONSTRAINT resumen_asistencia_curso_id_alumno_fkey FOREIGN KEY (id_alumno) REFERENCES public.alumnos(id_alumno) ON DELETE CASCADE;


--
-- Name: resumen_asistencia_curso resumen_asistencia_curso_id_curso_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumen_asistencia_curso
    ADD CONSTRAINT resumen_asistencia_curso_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE CASCADE;


--
-- Name: tutores_grado tutores_grado_id_grado_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tutores_grado
    ADD CONSTRAINT tutores_grado_id_grado_fkey FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE CASCADE;


--
-- Name: tutores_grado tutores_grado_id_personal_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tutores_grado
    ADD CONSTRAINT tutores_grado_id_personal_fkey FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_id_rol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.roles(id_rol) ON UPDATE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict H2pgqSdeNQDJT6NpujBv97p4exn4khVaki89wHtGzEkalfL4fDjh0v0yDXHuSPm

