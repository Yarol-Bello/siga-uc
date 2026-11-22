-- ============================================================
-- SOLO PARA DEMO. No ejecutar en una base con datos reales.
--
-- H47 — Docentes ficticios y carga balanceada para demostrar el
-- generador de horarios.
--
-- Qué hace:
--   1. Detecta, por cargas existentes del año, qué áreas ya tienen
--      un DOCENTE activo. Es determinista: no usa nombres ni
--      heurísticas; elige el menor id_personal del área.
--   2. Crea solo los docentes demo que faltan:
--        - Docente Demo 1: Geometría/Trigonometría/Razonamiento Matemático.
--        - Docente Demo 2: Aritmética/Álgebra (solo si no hay docente
--          activo con cargas de Matemática).
--        - Docente Demo 3: Lenguaje (solo si falta).
--        - Docente Demo 4: Ciencias Naturales (solo si falta).
--        - Docente Demo 5: Ciencias Sociales (solo si falta).
--      En local reutiliza a Pérez, Aguilar, Vilchez y Gómez; en
--      Supabase, donde no hay docentes, crea los 5.
--   3. Reasigna TODAS las cargas del año a los 5 docentes resultantes,
--      respetando el área y el máximo de 40 h.
--   4. Verifica que no queden cargas fuera del reparto y que nadie
--      supere 40 h.
--
-- No toca alumnos, pagos, pensiones, grados, cursos ni horarios.
-- Si hay horarios generados o publicados, aborta para no dejar
-- bloques apuntando a un docente anterior.
--
-- Idempotente: usuarios/personal/QR se actualizan por DNI y las cargas
-- se vuelven a repartir por área.
--
-- Limpieza comentada al final.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_anio integer;
  v_cargas integer;
  v_horas numeric;

  v_existing_math integer;
  v_existing_lang integer;
  v_existing_science integer;
  v_existing_social integer;

  v_demo1 integer;
  v_demo2 integer;
  v_demo3 integer;
  v_demo4 integer;
  v_demo5 integer;

  v_math_arith integer;
  v_lang integer;
  v_science integer;
  v_social integer;
BEGIN
  SELECT MAX(anio_lectivo)
    INTO v_anio
    FROM public.carga_curricular;

  IF v_anio IS NULL THEN
    RAISE EXCEPTION 'H47 demo: no hay carga curricular para ningún año.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.horarios
    WHERE anio_lectivo = v_anio
      AND estado = 'PUBLICADO'
  ) THEN
    RAISE EXCEPTION
      'H47 demo: hay horarios PUBLICADOS en %. Despublique o limpie antes de reejecutar el script.',
      v_anio;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.horarios
    WHERE anio_lectivo = v_anio
      AND creado_por IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'H47 demo: hay horarios generados en %. Ejecute la limpieza antes de reejecutar el script.',
      v_anio;
  END IF;

  -- ------------------------------------------------------------
  -- 1. Detección determinista por cargas existentes
  --    Solo DOCENTE activo y fuera del rango demo 990000xx.
  -- ------------------------------------------------------------
  SELECT MIN(p.id_personal)
    INTO v_existing_math
    FROM public.carga_curricular cc
    INNER JOIN public.cursos c ON c.id_curso = cc.id_curso
    INNER JOIN public.personal p ON p.id_personal = cc.id_personal
    INNER JOIN public.usuarios u ON u.id_usuario = p.id_usuario
   WHERE cc.anio_lectivo = v_anio
     AND c.area_academica = 'Matemáticas'
     AND u.id_rol = 2
     AND u.estado = 'ACTIVO'
     AND u.dni NOT LIKE '990000%';

  SELECT MIN(p.id_personal)
    INTO v_existing_lang
    FROM public.carga_curricular cc
    INNER JOIN public.cursos c ON c.id_curso = cc.id_curso
    INNER JOIN public.personal p ON p.id_personal = cc.id_personal
    INNER JOIN public.usuarios u ON u.id_usuario = p.id_usuario
   WHERE cc.anio_lectivo = v_anio
     AND c.area_academica = 'Lenguaje y Letras'
     AND u.id_rol = 2
     AND u.estado = 'ACTIVO'
     AND u.dni NOT LIKE '990000%';

  SELECT MIN(p.id_personal)
    INTO v_existing_science
    FROM public.carga_curricular cc
    INNER JOIN public.cursos c ON c.id_curso = cc.id_curso
    INNER JOIN public.personal p ON p.id_personal = cc.id_personal
    INNER JOIN public.usuarios u ON u.id_usuario = p.id_usuario
   WHERE cc.anio_lectivo = v_anio
     AND c.area_academica = 'Ciencias Naturales'
     AND u.id_rol = 2
     AND u.estado = 'ACTIVO'
     AND u.dni NOT LIKE '990000%';

  SELECT MIN(p.id_personal)
    INTO v_existing_social
    FROM public.carga_curricular cc
    INNER JOIN public.cursos c ON c.id_curso = cc.id_curso
    INNER JOIN public.personal p ON p.id_personal = cc.id_personal
    INNER JOIN public.usuarios u ON u.id_usuario = p.id_usuario
   WHERE cc.anio_lectivo = v_anio
     AND c.area_academica = 'Ciencias Sociales'
     AND u.id_rol = 2
     AND u.estado = 'ACTIVO'
     AND u.dni NOT LIKE '990000%';

  -- ------------------------------------------------------------
  -- 2. Usuarios demo: solo los necesarios
  -- ------------------------------------------------------------
  INSERT INTO public.usuarios (
    dni, nombres, apellidos, correo_institucional, correo_personal,
    password_hash, telefono, id_rol, estado, requiere_cambio_password
  )
  SELECT
    d.dni,
    d.nombres,
    d.apellidos,
    d.correo,
    d.correo,
    crypt(d.dni, gen_salt('bf', 10)),
    NULL,
    2,
    'ACTIVO',
    false
  FROM (
    VALUES
      ('99000001', 'Docente', 'Demo 1', 'docente.demo1@demo.local', true),
      ('99000002', 'Docente', 'Demo 2', 'docente.demo2@demo.local', v_existing_math IS NULL),
      ('99000003', 'Docente', 'Demo 3', 'docente.demo3@demo.local', v_existing_lang IS NULL),
      ('99000004', 'Docente', 'Demo 4', 'docente.demo4@demo.local', v_existing_science IS NULL),
      ('99000005', 'Docente', 'Demo 5', 'docente.demo5@demo.local', v_existing_social IS NULL)
  ) AS d(dni, nombres, apellidos, correo, crear)
  WHERE d.crear
  ON CONFLICT (dni) DO UPDATE SET
    nombres = EXCLUDED.nombres,
    apellidos = EXCLUDED.apellidos,
    correo_institucional = EXCLUDED.correo_institucional,
    correo_personal = EXCLUDED.correo_personal,
    password_hash = crypt(EXCLUDED.dni::text, gen_salt('bf', 10)),
    id_rol = 2,
    estado = 'ACTIVO',
    requiere_cambio_password = false;

  INSERT INTO public.personal (
    id_usuario, especialidad, cargo, fecha_ingreso
  )
  SELECT
    u.id_usuario,
    d.especialidad,
    'Docente',
    CURRENT_DATE
  FROM (
    VALUES
      ('99000001', 'Lic. Educación - Matemáticas'),
      ('99000002', 'Lic. Educación - Matemáticas'),
      ('99000003', 'Lic. Educación - Lenguaje'),
      ('99000004', 'Lic. Educación - Ciencias Naturales'),
      ('99000005', 'Lic. Educación - Ciencias Sociales')
  ) AS d(dni, especialidad)
  INNER JOIN public.usuarios u ON u.dni = d.dni
  ON CONFLICT (id_usuario) DO UPDATE SET
    especialidad = EXCLUDED.especialidad,
    cargo = 'Docente',
    fecha_ingreso = EXCLUDED.fecha_ingreso,
    fecha_cese = NULL,
    motivo_cese = NULL;

  -- Mismo patrón que personalDao.crear: QR-<DNI>-<MD5(DNI + SIGAUC)>
  INSERT INTO public.credenciales_qr (
    id_usuario, codigo_qr, tipo
  )
  SELECT
    u.id_usuario,
    'QR-' || u.dni || '-' || UPPER(MD5(u.dni || 'SIGAUC')),
    'DOCENTE'
  FROM public.usuarios u
  WHERE u.dni IN (
    '99000001', '99000002', '99000003', '99000004', '99000005'
  )
  ON CONFLICT (id_usuario) DO UPDATE SET
    codigo_qr = EXCLUDED.codigo_qr,
    tipo = 'DOCENTE',
    activo = true;

  -- ------------------------------------------------------------
  -- 3. Resolver los cinco docentes del reparto
  -- ------------------------------------------------------------
  SELECT p.id_personal INTO v_demo1
    FROM public.usuarios u
    INNER JOIN public.personal p ON p.id_usuario = u.id_usuario
   WHERE u.dni = '99000001';

  SELECT p.id_personal INTO v_demo2
    FROM public.usuarios u
    INNER JOIN public.personal p ON p.id_usuario = u.id_usuario
   WHERE u.dni = '99000002';

  SELECT p.id_personal INTO v_demo3
    FROM public.usuarios u
    INNER JOIN public.personal p ON p.id_usuario = u.id_usuario
   WHERE u.dni = '99000003';

  SELECT p.id_personal INTO v_demo4
    FROM public.usuarios u
    INNER JOIN public.personal p ON p.id_usuario = u.id_usuario
   WHERE u.dni = '99000004';

  SELECT p.id_personal INTO v_demo5
    FROM public.usuarios u
    INNER JOIN public.personal p ON p.id_usuario = u.id_usuario
   WHERE u.dni = '99000005';

  v_math_arith := COALESCE(v_existing_math, v_demo2);
  v_lang := COALESCE(v_existing_lang, v_demo3);
  v_science := COALESCE(v_existing_science, v_demo4);
  v_social := COALESCE(v_existing_social, v_demo5);

  IF v_demo1 IS NULL OR v_math_arith IS NULL OR
     v_lang IS NULL OR v_science IS NULL OR v_social IS NULL THEN
    RAISE EXCEPTION
      'H47 demo: no se pudieron resolver los 5 docentes del reparto (demo1=%, math=%, lang=%, science=%, social=%).',
      v_demo1, v_math_arith, v_lang, v_science, v_social;
  END IF;

  -- ------------------------------------------------------------
  -- 4. Reparto por área y curso
  -- ------------------------------------------------------------
  UPDATE public.carga_curricular cc
     SET id_personal = CASE
       WHEN c.nombre_curso IN ('Aritmética', 'Álgebra') THEN v_math_arith
       WHEN c.area_academica = 'Matemáticas' THEN v_demo1
       WHEN c.area_academica = 'Lenguaje y Letras' THEN v_lang
       WHEN c.area_academica = 'Ciencias Naturales' THEN v_science
       WHEN c.area_academica = 'Ciencias Sociales' THEN v_social
       ELSE cc.id_personal
     END
    FROM public.cursos c
   WHERE cc.id_curso = c.id_curso
     AND cc.anio_lectivo = v_anio;

  -- ------------------------------------------------------------
  -- 5. Verificaciones
  -- ------------------------------------------------------------
  IF EXISTS (
    SELECT 1
    FROM public.carga_curricular cc
    WHERE cc.anio_lectivo = v_anio
      AND cc.id_personal NOT IN (
        v_math_arith, v_demo1, v_lang, v_science, v_social
      )
  ) THEN
    RAISE EXCEPTION
      'H47 demo: quedaron cargas fuera del reparto. Revise cursos o áreas nuevas.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        cc.id_personal,
        SUM(COALESCE(cc.horas_asignadas, c.horas_semanales, 2)) AS horas
      FROM public.carga_curricular cc
      INNER JOIN public.cursos c ON c.id_curso = cc.id_curso
      WHERE cc.anio_lectivo = v_anio
      GROUP BY cc.id_personal
    ) x
    WHERE x.id_personal IN (
      v_math_arith, v_demo1, v_lang, v_science, v_social
    )
      AND x.horas > 40
  ) THEN
    RAISE EXCEPTION
      'H47 demo: un docente supera las 40 h. Revise la distribución.';
  END IF;

  SELECT
    COUNT(*),
    COALESCE(SUM(COALESCE(cc.horas_asignadas, c.horas_semanales, 2)), 0)
    INTO v_cargas, v_horas
    FROM public.carga_curricular cc
    INNER JOIN public.cursos c ON c.id_curso = cc.id_curso
   WHERE cc.anio_lectivo = v_anio;

  RAISE NOTICE
    'H47 demo OK: año %, % cargas, % horas. Docentes: math-ari/alg=%, demo1=%, lenguaje=%, ciencias=%, sociales=%.',
    v_anio, v_cargas, v_horas,
    v_math_arith, v_demo1, v_lang, v_science, v_social;
END $$;

COMMIT;

-- ============================================================
-- LIMPIEZA (comentada)
--
-- Descomentar y ejecutar SOLO para devolver la demo a su estado base:
--   - borra los horarios generados por el ADMIN en el año;
--   - asegura una ficha personal del ADMIN (en local puede no existir);
--   - devuelve TODAS las cargas al ADMIN;
--   - borra credenciales, personal y usuarios demo;
--   - conserva horarios_h47_backup intacto.
--
-- BEGIN;
-- DO $$
-- DECLARE
--   v_anio integer;
--   v_admin integer;
--   v_demo_ids integer[];
--   v_horarios integer;
-- BEGIN
--   SELECT MAX(anio_lectivo) INTO v_anio FROM public.carga_curricular;
--   IF v_anio IS NULL THEN
--     RAISE EXCEPTION 'H47 limpieza: no hay carga curricular.';
--   END IF;
--
--   DELETE FROM public.horarios
--    WHERE anio_lectivo = v_anio
--      AND creado_por IS NOT NULL;
--   GET DIAGNOSTICS v_horarios = ROW_COUNT;
--   RAISE NOTICE 'Horarios generados eliminados: %', v_horarios;
--
--   INSERT INTO public.personal (id_usuario, especialidad, cargo, fecha_ingreso)
--   SELECT u.id_usuario, NULL, 'Administrador', CURRENT_DATE
--     FROM public.usuarios u
--    WHERE u.dni = '74829102'
--      AND NOT EXISTS (
--        SELECT 1 FROM public.personal p WHERE p.id_usuario = u.id_usuario
--      );
--
--   SELECT p.id_personal INTO v_admin
--     FROM public.usuarios u
--     INNER JOIN public.personal p ON p.id_usuario = u.id_usuario
--    WHERE u.dni = '74829102'
--    ORDER BY p.id_personal
--    LIMIT 1;
--
--   IF v_admin IS NULL THEN
--     RAISE EXCEPTION 'H47 limpieza: no se encontró/creó la ficha del ADMIN 74829102.';
--   END IF;
--
--   UPDATE public.carga_curricular
--      SET id_personal = v_admin
--    WHERE anio_lectivo = v_anio;
--
--   SELECT ARRAY_AGG(u.id_usuario)
--     INTO v_demo_ids
--     FROM public.usuarios u
--    WHERE u.dni IN (
--      '99000001', '99000002', '99000003', '99000004', '99000005'
--    );
--
--   DELETE FROM public.credenciales_qr
--    WHERE id_usuario = ANY(COALESCE(v_demo_ids, '{}'::integer[]));
--
--   DELETE FROM public.personal
--    WHERE id_usuario = ANY(COALESCE(v_demo_ids, '{}'::integer[]));
--
--   DELETE FROM public.usuarios
--    WHERE id_usuario = ANY(COALESCE(v_demo_ids, '{}'::integer[]));
--
--   IF EXISTS (
--     SELECT 1 FROM public.usuarios
--      WHERE dni IN ('99000001','99000002','99000003','99000004','99000005')
--   ) THEN
--     RAISE EXCEPTION 'H47 limpieza: quedaron usuarios demo.';
--   END IF;
--
--   IF EXISTS (
--     SELECT 1 FROM public.carga_curricular
--      WHERE anio_lectivo = v_anio
--        AND id_personal <> v_admin
--   ) THEN
--     RAISE EXCEPTION 'H47 limpieza: quedaron cargas fuera del ADMIN.';
--   END IF;
--
--   RAISE NOTICE 'H47 limpieza OK: cargas al ADMIN %, usuarios demo eliminados, horarios generados eliminados, backup intacto.', v_admin;
-- END $$;
-- COMMIT;
