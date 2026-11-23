-- ============================================================
-- Demo H80 — Relleno de conclusiones descriptivas estructuradas
-- Solo para bases de demostración/UAT con datos ficticios.
-- No ejecutar en una base con conclusiones reales: reemplaza textos
-- genéricos por plantillas de demostración.
--
-- Respeta las conclusiones que ya tengan avance, dificultad o
-- sugerencia (por ejemplo, las editadas por un docente).
-- ============================================================

BEGIN;

WITH base AS (
  SELECT
    id_conclusion,
    nivel_logro,
    CASE nivel_logro
      WHEN 'AD' THEN 'Demuestra un dominio destacado de los aprendizajes del área y participa con iniciativa.'
      WHEN 'A' THEN 'Logra los aprendizajes esperados del área y cumple con las actividades propuestas.'
      WHEN 'B' THEN 'Está en proceso de lograr los aprendizajes del área y participa en las actividades.'
      WHEN 'C' THEN 'Requiere apoyo para alcanzar los aprendizajes esperados del área.'
      ELSE NULL
    END AS avance,
    CASE nivel_logro
      WHEN 'AD' THEN 'No se identifican dificultades relevantes; puede asumir retos de mayor complejidad.'
      WHEN 'A' THEN 'Requiere consolidar la transferencia de lo aprendido a situaciones nuevas.'
      WHEN 'B' THEN 'Requiere acompañamiento y práctica adicional para consolidar sus aprendizajes.'
      WHEN 'C' THEN 'Presenta dificultades en los aprendizajes del área y necesita refuerzo.'
      ELSE NULL
    END AS dificultad,
    CASE nivel_logro
      WHEN 'AD' THEN 'Se recomienda continuar con situaciones desafiantes y compartir sus estrategias.'
      WHEN 'A' THEN 'Se recomienda practicar con casos contextualizados y explicar sus procedimientos.'
      WHEN 'B' THEN 'Se recomienda práctica guiada y retroalimentación constante.'
      WHEN 'C' THEN 'Se recomienda seguimiento cercano, actividades breves y acompañamiento de la familia.'
      ELSE NULL
    END AS sugerencia
  FROM public.conclusiones_descriptivas
  WHERE nivel_logro IN ('AD', 'A', 'B', 'C')
    AND (avance IS NULL OR dificultad IS NULL OR sugerencia IS NULL)
)
UPDATE public.conclusiones_descriptivas cd
SET
  avance = b.avance,
  dificultad = b.dificultad,
  sugerencia = b.sugerencia,
  descripcion = b.avance || ' ' || b.dificultad || ' ' || b.sugerencia,
  estado = 'PUBLICADO',
  actualizado_en = now()
FROM base b
WHERE cd.id_conclusion = b.id_conclusion;

COMMIT;

-- Demo H80 aplicada: conclusiones estructuradas de demostración.
