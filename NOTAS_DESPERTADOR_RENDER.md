# Despertador de servicios Render — contexto para retomar aquí

Nota dejada desde una sesión de Claude Code que estaba trabajando en
`centros-integrales-saas` (proyecto hermano, en
`D:\PROYECTOS\WEB\centros-integrales-saas`), a pedido del usuario, para
que una sesión nueva de Claude Code abierta directamente en **este**
repo tenga el contexto sin tener que repetir la conversación.

## El problema

Los servicios en el tier gratuito de Render se duermen tras ~15 min sin
tráfico entrante. El usuario tenía un despertador con cron-job.org que
se autodesactivaba solo cada tarde: los pingers gratuitos de ese tipo
desactivan el job tras varias ejecuciones fallidas seguidas, y un
servicio totalmente dormido puede tardar 30-60+s en responder al primer
ping — más que el timeout típico de esos pingers. Por eso el usuario
tenía que entrar él mismo cada mañana a "precalentar" el servicio antes
de que los pings automáticos retomaran.

## La solución ya implementada en centros-integrales-saas (no aplica
## igual aquí — ver por qué abajo)

Allá el backend es Supabase, así que se resolvió con `pg_cron` +
`pg_net`: un cron corriendo *dentro* de la propia base de datos, cada
10 minutos, haciendo `net.http_get(...)` a cada servicio.

**Aquí NO aplica igual**: el `docker-compose.yml` de este repo muestra
Postgres genérico (`postgres:15-alpine`), no Supabase — `pg_cron`/
`pg_net` son extensiones curadas por Supabase, normalmente no
disponibles en un Postgres autogestionado o en el Postgres administrado
de Render.

## La solución correcta para ESTE proyecto: un `BackgroundService` .NET

Este repo ya tiene el patrón exacto que hace falta, funcionando en
producción — no hay que inventar nada nuevo, solo copiar la forma:

**`backend-api/ErpStore.Infrastructure/Services/LowStockBackgroundService.cs`**
— un `BackgroundService` con un loop
`while (!stoppingToken.IsCancellationRequested) { trabajo; await Task.Delay(intervalo, stoppingToken); }`,
registrado en `backend-api/Program.cs:35` con
`builder.Services.AddHostedService<LowStockBackgroundService>();`.

Un `RenderKeepAliveBackgroundService` nuevo, hermano de ese archivo,
seguiría la misma forma: en vez de revisar stock bajo, hace un `GET`
real (vía `HttpClient`/`IHttpClientFactory`) cada ~10 minutos a la URL
pública de cada servicio que haya que mantener despierto — **incluida
la suya propia**: un self-ping funciona porque es una llamada HTTP real
de ida y vuelta por internet, que sí cuenta como tráfico entrante para
Render (no es una llamada interna al mismo proceso).

URL real ya confirmada (`open-api-facturacion-sri/render.yaml`):
`https://api-facturacion-sri.onrender.com` (plan free, región ohio).
Falta la URL pública de `backend-api` mismo (no está en un
`render.yaml` committeado — se deployó por dashboard, no por blueprint;
pídesela al usuario o revisa el dashboard de Render).

## Sobre el intervalo

10 minutos deja ~5 min de colchón contra el umbral de 15 min de Render.
El usuario preguntó por bajar a cada 13-14 min para "ahorrar cuota
gratuita" — no hace falta: el ping pesa unos bytes, no hay límite
realista de ancho de banda que esto vaya a tocar. El riesgo real de
espaciar más los pings es reducir el colchón contra el umbral de 15
min (13-14 min deja solo 1-2 min de margen, cualquier retraso de red
puede dejarlo dormir de todos modos, de forma intermitente y difícil de
notar). Recomendado: mantener 10 min, o 12 min como máximo si de
verdad se quiere reducir la frecuencia.

## Siguiente paso sugerido

Implementar `RenderKeepAliveBackgroundService.cs` siguiendo el patrón
de `LowStockBackgroundService.cs`, registrarlo en `Program.cs`, pedirle
al usuario la URL pública de `backend-api`, y verificar con un ping
manual real (no solo que el código compile) que cada servicio responde
200 antes de dar por terminado.
