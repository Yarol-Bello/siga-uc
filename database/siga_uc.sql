--
-- PostgreSQL database dump
--

\restrict a35vdEZI3VyglUlTLC6BM5C6zuAYxp3x6WuuoyWe4A2G2Q5ypwhz7qbyFRQa3Oh

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
-- Name: fn_horario_validar_carga(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_horario_validar_carga() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_carga record;
    v_grado_anio integer;
    v_periodo record;
BEGIN
    SELECT cc.id_grado, cc.id_curso, cc.id_personal, cc.anio_lectivo
      INTO v_carga
      FROM public.carga_curricular cc
     WHERE cc.id_carga = NEW.id_carga;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La carga curricular % no existe.', NEW.id_carga
            USING ERRCODE = '23503';
    END IF;

    IF NEW.id_grado IS NULL THEN
        NEW.id_grado := v_carga.id_grado;
    ELSIF NEW.id_grado <> v_carga.id_grado THEN
        RAISE EXCEPTION 'El grado del horario no coincide con la carga curricular.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.id_curso IS NULL THEN
        NEW.id_curso := v_carga.id_curso;
    ELSIF NEW.id_curso <> v_carga.id_curso THEN
        RAISE EXCEPTION 'El curso del horario no coincide con la carga curricular.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.id_personal IS NULL THEN
        NEW.id_personal := v_carga.id_personal;
    ELSIF NEW.id_personal <> v_carga.id_personal THEN
        RAISE EXCEPTION 'El docente del horario no coincide con la carga curricular.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.anio_lectivo IS NULL THEN
        NEW.anio_lectivo := v_carga.anio_lectivo;
    ELSIF NEW.anio_lectivo <> v_carga.anio_lectivo THEN
        RAISE EXCEPTION 'El año del horario no coincide con el año de la carga curricular.'
            USING ERRCODE = '23514';
    END IF;

    SELECT g.anio_lectivo
      INTO v_grado_anio
      FROM public.grados g
     WHERE g.id_grado = NEW.id_grado;

    IF NOT FOUND OR v_grado_anio <> NEW.anio_lectivo THEN
        RAISE EXCEPTION 'El grado no corresponde al año lectivo del horario.'
            USING ERRCODE = '23514';
    END IF;

    SELECT p.anio_lectivo, p.tipo, p.activo
      INTO v_periodo
      FROM public.periodos_clase p
     WHERE p.id_periodo = NEW.id_periodo;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El período % no existe.', NEW.id_periodo
            USING ERRCODE = '23503';
    END IF;

    IF v_periodo.anio_lectivo <> NEW.anio_lectivo THEN
        RAISE EXCEPTION 'El período no corresponde al año lectivo del horario.'
            USING ERRCODE = '23514';
    END IF;

    IF v_periodo.tipo <> 'CLASE' THEN
        RAISE EXCEPTION 'El período seleccionado no es de clase; no admite horarios.'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'INSERT' AND v_periodo.activo = false THEN
        RAISE EXCEPTION 'El período seleccionado está inactivo.'
            USING ERRCODE = '23514';
    END IF;

    NEW.aula := NULLIF(btrim(NEW.aula), '');
    IF TG_OP = 'UPDATE' THEN
        NEW.actualizado_en := now();
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_horario_validar_carga() OWNER TO postgres;

--
-- Name: fn_periodo_clase_validar(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_periodo_clase_validar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.hora_fin <= NEW.hora_inicio THEN
        RAISE EXCEPTION 'La hora de fin debe ser mayor que la hora de inicio.'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.periodos_clase p
        WHERE p.anio_lectivo = NEW.anio_lectivo
          AND p.id_periodo <> NEW.id_periodo
          AND NEW.hora_inicio < p.hora_fin
          AND NEW.hora_fin > p.hora_inicio
    ) THEN
        RAISE EXCEPTION 'El período se solapa con otro período del año %.', NEW.anio_lectivo
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF EXISTS (
            SELECT 1 FROM public.horarios h WHERE h.id_periodo = OLD.id_periodo
        ) AND (
            NEW.anio_lectivo <> OLD.anio_lectivo
            OR NEW.hora_inicio <> OLD.hora_inicio
            OR NEW.hora_fin <> OLD.hora_fin
            OR NEW.tipo <> OLD.tipo
        ) THEN
            RAISE EXCEPTION 'No se puede cambiar el año, horario o tipo de un período que ya tiene bloques asignados.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_periodo_clase_validar() OWNER TO postgres;

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
    SELECT ap.id_apertura INTO v_apertura
    FROM aperturas_caja ap
    WHERE NOT EXISTS (
        SELECT 1 FROM cierres_caja cc
        WHERE cc.id_apertura = ap.id_apertura
    )
    ORDER BY ap.fecha_apertura DESC
    LIMIT 1;

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
    CONSTRAINT chk_acta_estado CHECK (((estado)::text = ANY (ARRAY[('ABIERTO'::character varying)::text, ('CERRADO'::character varying)::text])))
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
    CONSTRAINT chk_alumno_condicion CHECK (((condicion)::text = ANY (ARRAY[('Regular'::character varying)::text, ('Traslado'::character varying)::text, ('Retirado'::character varying)::text]))),
    CONSTRAINT chk_alumno_dni CHECK ((dni ~ '^[0-9]{8}$'::text)),
    CONSTRAINT chk_alumno_estado CHECK (((estado_matricula)::text = ANY (ARRAY[('Matriculado'::character varying)::text, ('PendientePago'::character varying)::text, ('Retirado'::character varying)::text])))
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
    CONSTRAINT chk_asis_personal_estado CHECK ((((estado)::text = ANY (ARRAY[('Puntual'::character varying)::text, ('Tardanza'::character varying)::text, ('Falta'::character varying)::text])) OR (estado IS NULL)))
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
    CONSTRAINT chk_beca_tipo CHECK (((tipo)::text = ANY (ARRAY[('SOCIOECONOMICA'::character varying)::text, ('HERMANOS'::character varying)::text, ('EXCELENCIA'::character varying)::text])))
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
    CONSTRAINT chk_boleta_estado CHECK ((((estado_sunat)::text = ANY (ARRAY[('ACEPTADO'::character varying)::text, ('PENDIENTE'::character varying)::text, ('RECHAZADO'::character varying)::text, ('ANULADO'::character varying)::text])) OR (estado_sunat IS NULL)))
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
    CONSTRAINT chk_caja_estado CHECK (((estado)::text = ANY (ARRAY[('ABIERTA'::character varying)::text, ('CERRADA'::character varying)::text])))
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
    CONSTRAINT chk_calif_valor CHECK (((calificacion)::text = ANY (ARRAY[('AD'::character varying)::text, ('A'::character varying)::text, ('B'::character varying)::text, ('C'::character varying)::text])))
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
    CONSTRAINT chk_cierre_estado CHECK (((estado)::text = ANY (ARRAY[('CUADRADO'::character varying)::text, ('SOBRANTE'::character varying)::text, ('FALTANTE'::character varying)::text])))
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
    CONSTRAINT chk_concepto_tipo CHECK (((tipo)::text = ANY (ARRAY[('MATRICULA'::character varying)::text, ('PENSION'::character varying)::text, ('OTROS'::character varying)::text])))
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
    CONSTRAINT chk_credencial_tipo CHECK (((tipo)::text = ANY (ARRAY[('ESTUDIANTE'::character varying)::text, ('DOCENTE'::character varying)::text, ('ADMIN'::character varying)::text, ('SECRETARIA'::character varying)::text])))
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
    CONSTRAINT chk_escala_codigo CHECK (((codigo)::text = ANY (ARRAY[('AD'::character varying)::text, ('A'::character varying)::text, ('B'::character varying)::text, ('C'::character varying)::text])))
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
    CONSTRAINT chk_estado_carga CHECK ((((estado)::text = ANY (ARRAY[('COMPLETO'::character varying)::text, ('PENDIENTE'::character varying)::text])) OR (estado IS NULL)))
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
    id_carga integer NOT NULL,
    id_grado integer NOT NULL,
    id_curso integer NOT NULL,
    id_personal integer NOT NULL,
    anio_lectivo integer NOT NULL,
    dia_semana character varying(15) NOT NULL,
    id_periodo integer NOT NULL,
    aula character varying(50),
    estado character varying(10) DEFAULT 'BORRADOR'::character varying NOT NULL,
    creado_por integer,
    actualizado_por integer,
    creado_en timestamp without time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_horario_aula CHECK (((aula IS NULL) OR ((btrim((aula)::text) <> ''::text) AND (length(btrim((aula)::text)) <= 50)))),
    CONSTRAINT chk_horario_dia CHECK (((dia_semana)::text = ANY (ARRAY[('Lunes'::character varying)::text, ('Martes'::character varying)::text, ('Miércoles'::character varying)::text, ('Jueves'::character varying)::text, ('Viernes'::character varying)::text]))),
    CONSTRAINT chk_horario_estado CHECK (((estado)::text = ANY (ARRAY[('BORRADOR'::character varying)::text, ('PUBLICADO'::character varying)::text])))
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
    CONSTRAINT chk_mov_tipo CHECK (((tipo)::text = ANY (ARRAY[('INGRESO'::character varying)::text, ('EGRESO'::character varying)::text, ('APERTURA'::character varying)::text])))
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
    CONSTRAINT chk_nota_final_valor CHECK (((nota_final)::text = ANY (ARRAY[('AD'::character varying)::text, ('A'::character varying)::text, ('B'::character varying)::text, ('C'::character varying)::text])))
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
    motivo_anulacion character varying(250),
    fecha_anulacion timestamp without time zone,
    id_usuario_anulacion integer,
    CONSTRAINT chk_pago_estado CHECK (((estado)::text = ANY (ARRAY[('PAGADO'::character varying)::text, ('ANULADO'::character varying)::text]))),
    CONSTRAINT chk_pago_forma CHECK (((forma_pago)::text = ANY (ARRAY[('Efectivo'::character varying)::text, ('Yape'::character varying)::text, ('Plin'::character varying)::text, ('Interbank'::character varying)::text, ('BCP'::character varying)::text, ('BBVA'::character varying)::text])))
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
    CONSTRAINT chk_pension_estado CHECK (((estado)::text = ANY (ARRAY[('PAGADO'::character varying)::text, ('PENDIENTE'::character varying)::text, ('ANULADO'::character varying)::text]))),
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
-- Name: periodos_clase; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.periodos_clase (
    id_periodo integer NOT NULL,
    anio_lectivo integer NOT NULL,
    nombre character varying(30) NOT NULL,
    orden integer NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    tipo character varying(10) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_periodo_clase_horas CHECK ((hora_fin > hora_inicio)),
    CONSTRAINT chk_periodo_clase_tipo CHECK (((tipo)::text = ANY (ARRAY[('CLASE'::character varying)::text, ('RECREO'::character varying)::text, ('ALMUERZO'::character varying)::text])))
);


ALTER TABLE public.periodos_clase OWNER TO postgres;

--
-- Name: periodos_clase_id_periodo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.periodos_clase_id_periodo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.periodos_clase_id_periodo_seq OWNER TO postgres;

--
-- Name: periodos_clase_id_periodo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.periodos_clase_id_periodo_seq OWNED BY public.periodos_clase.id_periodo;


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
    CONSTRAINT chk_preticket_estado CHECK (((estado)::text = ANY (ARRAY[('PENDIENTE'::character varying)::text, ('PAGADO'::character varying)::text, ('ANULADO'::character varying)::text])))
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
    CONSTRAINT chk_rol_nombre CHECK (((nombre_rol)::text = ANY (ARRAY[('ADMIN'::character varying)::text, ('DOCENTE'::character varying)::text, ('SECRETARIA'::character varying)::text, ('ESTUDIANTE'::character varying)::text])))
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
    CONSTRAINT chk_usuario_estado CHECK (((estado)::text = ANY (ARRAY[('ACTIVO'::character varying)::text, ('INACTIVO'::character varying)::text, ('CESADO'::character varying)::text])))
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
-- Name: periodos_clase id_periodo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.periodos_clase ALTER COLUMN id_periodo SET DEFAULT nextval('public.periodos_clase_id_periodo_seq'::regclass);


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
-- Name: boletas_electronicas boletas_serie_numero_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boletas_electronicas
    ADD CONSTRAINT boletas_serie_numero_key UNIQUE (serie, numero);


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
-- Name: periodos_clase periodos_clase_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.periodos_clase
    ADD CONSTRAINT periodos_clase_pkey PRIMARY KEY (id_periodo);


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
-- Name: horarios uq_horario_docente_bloque; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT uq_horario_docente_bloque UNIQUE (anio_lectivo, id_personal, dia_semana, id_periodo);


--
-- Name: horarios uq_horario_grado_bloque; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT uq_horario_grado_bloque UNIQUE (anio_lectivo, id_grado, dia_semana, id_periodo);


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
-- Name: periodos_clase uq_periodo_clase_anio_orden; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.periodos_clase
    ADD CONSTRAINT uq_periodo_clase_anio_orden UNIQUE (anio_lectivo, orden);


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
-- Name: idx_horario_anio_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_horario_anio_estado ON public.horarios USING btree (anio_lectivo, estado);


--
-- Name: idx_horario_carga; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_horario_carga ON public.horarios USING btree (id_carga);


--
-- Name: idx_horario_docente_dia; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_horario_docente_dia ON public.horarios USING btree (id_personal, dia_semana);


--
-- Name: idx_horario_grado_dia; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_horario_grado_dia ON public.horarios USING btree (id_grado, dia_semana);


--
-- Name: idx_horario_periodo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_horario_periodo ON public.horarios USING btree (id_periodo);


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
-- Name: idx_periodos_clase_anio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_periodos_clase_anio ON public.periodos_clase USING btree (anio_lectivo, orden);


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
-- Name: uq_horario_aula_bloque; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_horario_aula_bloque ON public.horarios USING btree (anio_lectivo, lower(btrim((aula)::text)), dia_semana, id_periodo) WHERE ((aula IS NOT NULL) AND (btrim((aula)::text) <> ''::text));


--
-- Name: calificaciones trg_calificaciones_audit; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_calificaciones_audit AFTER INSERT OR UPDATE ON public.calificaciones FOR EACH ROW EXECUTE FUNCTION public.trg_auditar_calificacion();


--
-- Name: horarios trg_horario_validar_carga; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_horario_validar_carga BEFORE INSERT OR UPDATE ON public.horarios FOR EACH ROW EXECUTE FUNCTION public.fn_horario_validar_carga();


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
-- Name: periodos_clase trg_periodo_clase_validar; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_periodo_clase_validar BEFORE INSERT OR UPDATE ON public.periodos_clase FOR EACH ROW EXECUTE FUNCTION public.fn_periodo_clase_validar();


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
-- Name: horarios fk_horario_actualizado_por; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT fk_horario_actualizado_por FOREIGN KEY (actualizado_por) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: horarios fk_horario_carga; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT fk_horario_carga FOREIGN KEY (id_carga) REFERENCES public.carga_curricular(id_carga) ON DELETE RESTRICT;


--
-- Name: horarios fk_horario_creado_por; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT fk_horario_creado_por FOREIGN KEY (creado_por) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


--
-- Name: horarios fk_horario_curso; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT fk_horario_curso FOREIGN KEY (id_curso) REFERENCES public.cursos(id_curso) ON DELETE RESTRICT;


--
-- Name: horarios fk_horario_grado; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT fk_horario_grado FOREIGN KEY (id_grado) REFERENCES public.grados(id_grado) ON DELETE RESTRICT;


--
-- Name: horarios fk_horario_periodo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT fk_horario_periodo FOREIGN KEY (id_periodo) REFERENCES public.periodos_clase(id_periodo) ON DELETE RESTRICT;


--
-- Name: horarios fk_horario_personal; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.horarios
    ADD CONSTRAINT fk_horario_personal FOREIGN KEY (id_personal) REFERENCES public.personal(id_personal) ON DELETE RESTRICT;


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
-- Name: pagos pagos_id_usuario_anulacion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_usuario_anulacion_fkey FOREIGN KEY (id_usuario_anulacion) REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;


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

\unrestrict a35vdEZI3VyglUlTLC6BM5C6zuAYxp3x6WuuoyWe4A2G2Q5ypwhz7qbyFRQa3Oh

