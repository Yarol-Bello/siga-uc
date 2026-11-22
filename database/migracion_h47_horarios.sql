-- ============================================================
-- H47 — Horarios por bloques, períodos y publicación
-- Migración idempotente.
--
-- 1. Crea periodos_clase por año lectivo.
-- 2. Reemplaza horarios por el modelo con id_carga, período, aula,
--    estado y año lectivo.
-- 3. Migra las filas CLASE existentes a BORRADOR y convierte los
--    recreos/almuerzos en períodos. Guarda el histórico en
--    horarios_h47_backup antes de tocar la tabla.
-- 4. Agrega las restricciones duras y los triggers de consistencia.
--
-- No edita siga_uc_completo.sql: ese dump se actualiza aplicando
-- esta migración en la secuencia de instalación.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Períodos de clase
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.periodos_clase (
    id_periodo serial NOT NULL,
    anio_lectivo integer NOT NULL,
    nombre character varying(30) NOT NULL,
    orden integer NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    tipo character varying(10) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT periodos_clase_pkey PRIMARY KEY (id_periodo),
    CONSTRAINT uq_periodo_clase_anio_orden UNIQUE (anio_lectivo, orden),
    CONSTRAINT chk_periodo_clase_tipo CHECK (
        tipo::text = ANY (ARRAY['CLASE'::character varying, 'RECREO'::character varying, 'ALMUERZO'::character varying]::text[])
    ),
    CONSTRAINT chk_periodo_clase_horas CHECK (hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_periodos_clase_anio
    ON public.periodos_clase (anio_lectivo, orden);

-- ------------------------------------------------------------
-- 2. Respaldo y reemplazo de horarios
-- ------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.horarios') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'horarios'
             AND column_name = 'id_carga'
       ) THEN
        IF EXISTS (SELECT 1 FROM public.horarios) THEN
            CREATE TABLE IF NOT EXISTS public.horarios_h47_backup AS
            SELECT * FROM public.horarios;
        END IF;

        DROP TABLE public.horarios;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.horarios (
    id_horario serial NOT NULL,
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
    CONSTRAINT horarios_pkey PRIMARY KEY (id_horario),
    CONSTRAINT uq_horario_grado_bloque
        UNIQUE (anio_lectivo, id_grado, dia_semana, id_periodo),
    CONSTRAINT uq_horario_docente_bloque
        UNIQUE (anio_lectivo, id_personal, dia_semana, id_periodo),
    CONSTRAINT fk_horario_carga
        FOREIGN KEY (id_carga) REFERENCES public.carga_curricular (id_carga)
        ON DELETE RESTRICT,
    CONSTRAINT fk_horario_grado
        FOREIGN KEY (id_grado) REFERENCES public.grados (id_grado)
        ON DELETE RESTRICT,
    CONSTRAINT fk_horario_curso
        FOREIGN KEY (id_curso) REFERENCES public.cursos (id_curso)
        ON DELETE RESTRICT,
    CONSTRAINT fk_horario_personal
        FOREIGN KEY (id_personal) REFERENCES public.personal (id_personal)
        ON DELETE RESTRICT,
    CONSTRAINT fk_horario_periodo
        FOREIGN KEY (id_periodo) REFERENCES public.periodos_clase (id_periodo)
        ON DELETE RESTRICT,
    CONSTRAINT fk_horario_creado_por
        FOREIGN KEY (creado_por) REFERENCES public.usuarios (id_usuario)
        ON DELETE SET NULL,
    CONSTRAINT fk_horario_actualizado_por
        FOREIGN KEY (actualizado_por) REFERENCES public.usuarios (id_usuario)
        ON DELETE SET NULL,
    CONSTRAINT chk_horario_dia CHECK (
        dia_semana::text = ANY (ARRAY['Lunes'::character varying, 'Martes'::character varying, 'Miércoles'::character varying, 'Jueves'::character varying, 'Viernes'::character varying]::text[])
    ),
    CONSTRAINT chk_horario_estado CHECK (
        estado::text = ANY (ARRAY['BORRADOR'::character varying, 'PUBLICADO'::character varying]::text[])
    ),
    CONSTRAINT chk_horario_aula CHECK (
        aula IS NULL OR (btrim(aula) <> '' AND length(btrim(aula)) <= 50)
    )
);

CREATE INDEX IF NOT EXISTS idx_horario_carga
    ON public.horarios (id_carga);
CREATE INDEX IF NOT EXISTS idx_horario_anio_estado
    ON public.horarios (anio_lectivo, estado);
CREATE INDEX IF NOT EXISTS idx_horario_grado_dia
    ON public.horarios (id_grado, dia_semana);
CREATE INDEX IF NOT EXISTS idx_horario_docente_dia
    ON public.horarios (id_personal, dia_semana);
CREATE INDEX IF NOT EXISTS idx_horario_periodo
    ON public.horarios (id_periodo);

CREATE UNIQUE INDEX IF NOT EXISTS uq_horario_aula_bloque
    ON public.horarios (
        anio_lectivo,
        lower(btrim(aula)),
        dia_semana,
        id_periodo
    )
    WHERE aula IS NOT NULL AND btrim(aula) <> '';

-- ------------------------------------------------------------
-- 3. Malla por defecto para los años existentes
--    Solo se inserta si el año no tiene ningún período.
-- ------------------------------------------------------------
DO $$
DECLARE
    v_anio integer;
BEGIN
    FOR v_anio IN
        SELECT DISTINCT anio_lectivo
        FROM public.grados
        ORDER BY anio_lectivo
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.periodos_clase WHERE anio_lectivo = v_anio
        ) THEN
            INSERT INTO public.periodos_clase
                (anio_lectivo, nombre, orden, hora_inicio, hora_fin, tipo, activo)
            VALUES
                (v_anio, '1ra hora',  1, '07:30', '08:15', 'CLASE',   true),
                (v_anio, '2da hora',  2, '08:15', '09:00', 'CLASE',   true),
                (v_anio, 'Receso',    3, '09:00', '09:30', 'RECREO',  true),
                (v_anio, '3ra hora',  4, '09:30', '10:15', 'CLASE',   true),
                (v_anio, '4ta hora',  5, '10:15', '11:00', 'CLASE',   true),
                (v_anio, '5ta hora',  6, '11:00', '11:45', 'CLASE',   true),
                (v_anio, '6ta hora',  7, '11:45', '12:30', 'CLASE',   true),
                (v_anio, 'Almuerzo',  8, '12:30', '13:00', 'ALMUERZO', true),
                (v_anio, '7ma hora',  9, '13:00', '13:45', 'CLASE',   true),
                (v_anio, '8va hora', 10, '13:45', '14:30', 'CLASE',   true);
        END IF;
    END LOOP;

    -- Una base sin grados (por ejemplo, producción recién creada)
    -- necesita la malla del año calendario para poder configurarse.
    IF NOT EXISTS (SELECT 1 FROM public.grados) THEN
        v_anio := EXTRACT(YEAR FROM CURRENT_DATE)::int;
        IF NOT EXISTS (
            SELECT 1 FROM public.periodos_clase WHERE anio_lectivo = v_anio
        ) THEN
            INSERT INTO public.periodos_clase
                (anio_lectivo, nombre, orden, hora_inicio, hora_fin, tipo, activo)
            VALUES
                (v_anio, '1ra hora',  1, '07:30', '08:15', 'CLASE',   true),
                (v_anio, '2da hora',  2, '08:15', '09:00', 'CLASE',   true),
                (v_anio, 'Receso',    3, '09:00', '09:30', 'RECREO',  true),
                (v_anio, '3ra hora',  4, '09:30', '10:15', 'CLASE',   true),
                (v_anio, '4ta hora',  5, '10:15', '11:00', 'CLASE',   true),
                (v_anio, '5ta hora',  6, '11:00', '11:45', 'CLASE',   true),
                (v_anio, '6ta hora',  7, '11:45', '12:30', 'CLASE',   true),
                (v_anio, 'Almuerzo',  8, '12:30', '13:00', 'ALMUERZO', true),
                (v_anio, '7ma hora',  9, '13:00', '13:45', 'CLASE',   true),
                (v_anio, '8va hora', 10, '13:45', '14:30', 'CLASE',   true);
        END IF;
    END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Triggers de períodos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_periodo_clase_validar()
RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_periodo_clase_validar ON public.periodos_clase;
CREATE TRIGGER trg_periodo_clase_validar
    BEFORE INSERT OR UPDATE ON public.periodos_clase
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_periodo_clase_validar();

-- ------------------------------------------------------------
-- 5. Triggers de horarios
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_horario_validar_carga()
RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_horario_validar_carga ON public.horarios;
CREATE TRIGGER trg_horario_validar_carga
    BEFORE INSERT OR UPDATE ON public.horarios
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_horario_validar_carga();

-- ------------------------------------------------------------
-- 6. Migración de las filas existentes
-- ------------------------------------------------------------
DO $$
DECLARE
    v_total_clases integer;
    v_mapeadas integer;
BEGIN
    IF to_regclass('public.horarios_h47_backup') IS NULL THEN
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.horarios) THEN
        INSERT INTO public.horarios (
            id_horario, id_carga, id_grado, id_curso, id_personal,
            anio_lectivo, dia_semana, id_periodo, aula, estado,
            creado_en, actualizado_en
        )
        SELECT
            b.id_horario,
            cc.id_carga,
            b.id_grado,
            b.id_curso,
            b.id_personal,
            g.anio_lectivo,
            b.dia_semana,
            p.id_periodo,
            NULL,
            'BORRADOR',
            now(),
            now()
        FROM public.horarios_h47_backup b
        JOIN public.grados g
          ON g.id_grado = b.id_grado
        JOIN public.carga_curricular cc
          ON cc.id_grado = b.id_grado
         AND cc.id_curso = b.id_curso
         AND cc.id_personal = b.id_personal
         AND cc.anio_lectivo = g.anio_lectivo
        JOIN public.periodos_clase p
          ON p.anio_lectivo = g.anio_lectivo
         AND p.hora_inicio = b.hora_inicio
         AND p.hora_fin = b.hora_fin
         AND p.tipo = 'CLASE'
        WHERE b.tipo_bloque = 'CLASE';

        IF EXISTS (SELECT 1 FROM public.horarios) THEN
            PERFORM setval(
                pg_get_serial_sequence('public.horarios', 'id_horario'),
                (SELECT MAX(id_horario) FROM public.horarios),
                true
            );
        ELSE
            PERFORM setval(
                pg_get_serial_sequence('public.horarios', 'id_horario'),
                1,
                false
            );
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_total_clases
      FROM public.horarios_h47_backup
     WHERE tipo_bloque = 'CLASE';

    SELECT COUNT(*) INTO v_mapeadas
      FROM public.horarios h
      JOIN public.horarios_h47_backup b ON b.id_horario = h.id_horario
     WHERE b.tipo_bloque = 'CLASE';

    IF v_total_clases <> v_mapeadas THEN
        RAISE EXCEPTION
            'H47: % bloques CLASE no se pudieron mapear. Revise horarios_h47_backup; no se borró nada.',
            v_total_clases - v_mapeadas;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.horarios_h47_backup b
        JOIN public.grados g ON g.id_grado = b.id_grado
        WHERE b.tipo_bloque IN ('RECREO', 'ALMUERZO')
          AND NOT EXISTS (
              SELECT 1
              FROM public.periodos_clase p
              WHERE p.anio_lectivo = g.anio_lectivo
                AND p.hora_inicio = b.hora_inicio
                AND p.hora_fin = b.hora_fin
                AND p.tipo = b.tipo_bloque
          )
    ) THEN
        RAISE EXCEPTION
            'H47: hay recreos o almuerzos sin un período equivalente. Revise horarios_h47_backup; no se borró nada.';
    END IF;
END $$;

COMMIT;
