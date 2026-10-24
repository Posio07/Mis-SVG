# Fuentes leídas para la tabla de músculos por ejercicio (`data/exercise-muscles.csv`)

Consulta del 2026-10-24. Complementa `fraccionado-pelland-remmert.md`. Los resúmenes se leyeron por la API pública de PubMed (E-utilities); **el texto completo no se abrió** salvo en los dos documentos de la otra nota. Por eso cada dato de abajo es lo que dice el resumen, y las notas de la CSV no afirman nada más que eso.

## Cómo se asignó el nivel de evidencia
- **verificado:** leí el resumen de un estudio que **midió hipertrofia** (resonancia, ultrasonido, espesor o área muscular) de ese músculo y cuyo resumen nombra el ejercicio entrenado o uno equivalente. Si el ejercicio es solo parecido, la nota lo dice ("equivalente").
- **probable:** el respaldo es solo EMG (estudio o revisión) o **la clasificación publicada de Pelland et al. 2026 (Tabla 1)**. Esto último amplía la definición pedida ("solo EMG o manual de referencia"): la Tabla 1 no mide nada, es la decisión de los autores sobre qué ejercicio cuenta como directo o indirecto para cada músculo medido. Si preferís la definición estricta, esas filas pasarían a `a_verificar` cambiando una columna.
- **a_verificar:** no leí ninguna fuente que lo respalde. Si hay una fuente en la columna `source` de una fila `a_verificar`, es porque aporta contexto o **evidencia en contra**, y la nota lo explica.

## Fuentes con su hallazgo

| # | Cita | Qué se leyó | Hallazgo usado |
| --- | --- | --- | --- |
| 1 | Pelland JC et al. 2026. Sports Med 56(2):481-505. doi:10.1007/s40279-025-02344-w | Texto completo | Tabla 1 (p. 5): clasificación de ejercicios directos e indirectos por músculo |
| 2 | Kubo K, Ikebukuro T, Yata H. 2019. Eur J Appl Physiol 119(9):1933-1942. doi:10.1007/s00421-019-04181-y (PMID 31230110) | Resumen | 17 hombres, 10 sem, resonancia: volumen de extensores de rodilla +4,9 % (sentadilla completa) y +4,6 % (media); glúteo mayor +6,7 % y +2,2 %; isquios sin cambio |
| 3 | Plotkin DL et al. 2023. Front Physiol 14:1279170. doi:10.3389/fphys.2023.1279170 (PMID 37877099) | Resumen | ECA de 9 sem, resonancia, sentadilla (n=16) vs hip thrust (n=18): área glútea similar; isquios y glúteo medio/menor sin crecimiento apreciable; cuádriceps y aductores crecen más con sentadilla |
| 4 | Contreras B et al. 2015. J Appl Biomech 31(6):452-458. doi:10.1123/jab.2014-0301 (PMID 26214739) | Resumen | EMG en 13 mujeres entrenadas: el hip thrust activa más glúteo mayor y bíceps femoral que la sentadilla (BF medio 40,8 % vs 14,9 % MVIC) |
| 5 | Kinoshita M et al. 2026. Med Sci Sports Exerc 58(7):1566-1580. doi:10.1249/MSS.0000000000003957 (PMID 41630124) | Resumen | 17 adultos, 12 sem, una pierna prensa y la otra extensión, resonancia de 17 músculos: prensa aumentó glúteo mayor +15,4 % y aductor mayor +6,2 %; extensión no; cuádriceps +4,9 % (prensa) y +7,1 % (extensión), recto femoral +1,1 % vs +13,2 % |
| 6 | Mannarino P et al. 2021. J Strength Cond Res 35(10):2677-2681. doi:10.1519/JSC.0000000000003234 (PMID 31268995) | Resumen | 10 hombres sin entrenamiento previo, 8 sem, ultrasonido: espesor de flexores del codo +11,06 % con curl de bíceps unilateral y +5,16 % con remo con mancuerna unilateral |
| 7 | Gentil P et al. 2013. Appl Physiol Nutr Metab 38(3):341-344. doi:10.1139/apnm-2012-0176 (PMID 23537028) | Resumen | 29 hombres sin entrenamiento previo, 10 sem: el grupo que solo hizo jalón al pecho y press banca aumentó el espesor de flexores del codo +6,5 % |
| 8 | Maeo S et al. 2021. Med Sci Sports Exerc 53(4):825-837. doi:10.1249/MSS.0000000000002523 (PMID 33009197) | Resumen | 20 adultos, 12 sem, resonancia: isquios totales +14 % (curl sentado) y +9 % (curl tumbado) |
| 9 | Kinoshita M et al. 2023. Front Physiol 14:1272106. doi:10.3389/fphys.2023.1272106 (PMID 38156065) | Resumen | 14 adultos, 12 sem: elevación de talones de pie, tríceps sural +5,6 %; sentado +2,1 % (sóleo +2,9 % significativo; gemelos sin cambio significativo) |
| 10 | Maeo S et al. 2023. Eur J Sport Sci 23(7):1240-1250. doi:10.1080/17461391.2022.2100279 (PMID 35819335) | Resumen | 21 adultos, 12 sem, resonancia: extensión de codo en polea, tríceps total +13,9 % (brazo neutro) y +19,9 % (sobre la cabeza) |
| 11 | Larsen S et al. 2025. Front Physiol 16:1611468. doi:10.3389/fphys.2025.1611468 (PMID 40692697) | Resumen | 24 entrenados, 8 sem, ultrasonido: deltoides lateral +3,3 % a +4,6 % con elevaciones laterales con mancuerna o polea, sin diferencias entre ambas |
| 12 | Attarieh P et al. 2026. J Strength Cond Res, publicación anticipada. doi:10.1519/JSC.0000000000005701 (PMID 42842490) | Resumen | 17 adultos, 10 sem, resonancia, ejercicios unilaterales en polea: extensión de cadera, glúteo mayor +9 %; abducción de cadera, glúteo mayor +5 % y glúteo medio/menor +4 % |
| 13 | Zabaleta-Korta A et al. 2023. J Hum Kinet 87:259-270. doi:10.5114/jhk/163561 (PMID 37559762) | Resumen | 38 mujeres, 9 sem: con curl inclinado ninguna región del bíceps aumentó su espesor; con curl predicador, sí (región distal) |
| 14 | Neto WK et al. 2020. J Sports Sci Med 19(1):195-203 (PMID 32132843) | Resumen | Revisión sistemática de EMG: activación muy alta (>60 % MVIC) del glúteo mayor en step-up, sentadilla dividida, zancadas, hip thrust y peso muerto convencional, entre otros |
| 15 | Coratella G et al. 2022. Int J Environ Res Public Health 19(3):1903. doi:10.3390/ijerph19031903 (PMID 35162922) | Resumen | EMG en 10 culturistas: glúteo mayor, bíceps femoral y semitendinoso medidos en el peso muerto rumano y sus variantes |
| 16 | Martín-Fuentes I et al. 2020. PLoS One 15(2):e0229507. doi:10.1371/journal.pone.0229507 (PMID 32107499) | Resumen | Revisión sistemática de EMG del peso muerto: en el rumano, bíceps femoral y semitendinoso más activos que los erectores |
| 17 | Youdas JW et al. 2010. J Strength Cond Res 24(12):3404-3414. doi:10.1519/JSC.0b013e3181f1598c (PMID 21068680) | Resumen | EMG en dominada y chin-up: dorsal ancho 117-130 % MVIC, bíceps 78-96 %, pectoral 44-57 % |
| 18 | Fischer J et al. 2025. J Electromyogr Kinesiol 83:103025. doi:10.1016/j.jelekin.2025.103025 (PMID 40513198) | Resumen | sEMG del remo prono con barra en trapecio transverso, deltoides posterior, dorsal ancho y bíceps; el resumen compara rangos de movimiento y no da magnitudes absolutas |
| 19 | Padovan R et al. 2026. J Hum Kinet 103:81-96. doi:10.5114/jhk/205466 (PMID 42713087) | Resumen | HD-sEMG del press de hombro (por delante y tras nuca): deltoides anterior, lateral, posterior, trapecio superior, pectoral mayor y tríceps como "prime movers" |
| 20 | Escamilla RF et al. 2006. Phys Ther 86(5):656-671 (PMID 16649890) | Resumen | EMG de ejercicios abdominales: recto abdominal más activo con rueda (roll-out), rodillas colgado y crunch inverso |
| 21 | McGill S et al. 2015. J Sports Sci 33(4):419-426. doi:10.1080/02640414.2014.946437 (PMID 25111163) | Resumen | La elevación de piernas colgado estiradas: >130 % MVC en recto abdominal y 88 % en oblicuo externo |
| 22 | Di Fonza D et al. 2026. J Funct Morphol Kinesiol 11(3):315. doi:10.3390/jfmk11030315 (PMID 42647355) | Resumen | Revisión narrativa de EMG del dorsal (23 estudios): el pullover parece activar más el pectoral mayor que el dorsal |
| 23 | Rabello R et al. 2024. J Bodyw Mov Ther 40:1309-1325. doi:10.1016/j.jbmt.2022.12.002 (PMID 39593452) | Resumen | Revisión sistemática de EMG de los tres deltoides: aducciones horizontales (aperturas) activan más el anterior; dominadas activan más el posterior |
| 24 | de Almeida Paz I et al. 2022. J Bodyw Mov Ther 30:160-167. doi:10.1016/j.jbmt.2022.01.001 (PMID 35500965) | Resumen | EMG: en la máquina de abducción de cadera el glúteo medio se activa más que el tensor de la fascia lata |

## Leídos y no usados como respaldo
- **Barbalho M et al. 2021** (Int J Sports Med 42(4):371-376, PMID 32252103): en 30 mujeres entrenadas, los grupos con ejercicios multiarticulares aumentaron más el espesor de glúteo mayor, cuádriceps y pectoral que el de monoarticulares. El resumen no dice qué ejercicios eran, así que no sirve para un `exerciseId` concreto.
- **Corrêa DA et al. 2022** (J Sports Med Phys Fitness 62(3):324-336, PMID 33634677): es el único estudio de pectoral del dataset de Pelland; el resumen no nombra los ejercicios de entrenamiento.
- **Schoenfeld BJ et al. 2019** (Sports 7(7):177, PMID 31336594): argumenta que las series multiarticulares podrían contarse de forma fraccionada para ciertos músculos, y aun así recomienda tomar el volumen en proporción 1:1 hasta tener más datos longitudinales. Es contexto para el 0,5, no respaldo de ninguna fila.

## Búsquedas sin resultado útil
Press inclinado, fondos y press en máquina como ejercicio de pectoral; face pull; vacuum abdominal; press landmine; búlgara con hipertrofia medida. No se encontró nada leído que los respalde, por eso esas filas quedan `a_verificar`.
