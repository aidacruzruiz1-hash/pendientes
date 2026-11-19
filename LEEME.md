# Pendientes: cómo ponerla en tu iPhone

Pendientes es una app web instalable: vive en internet, la agregas a la pantalla de inicio desde Safari y se abre como cualquier otra app (sin barra de Safari y con su propio ícono). No necesitas Mac, Xcode ni cuenta de desarrollador.

## Qué hace

- **Categorías:** Personal, Escuela y Trabajo. En Ajustes ⚙︎ puedes crear más (por ejemplo Gym o Casa), renombrarlas, cambiarles el color tocando el círculo, o quitarlas.
- **Vista Hoy:** lo que vence hoy y lo atrasado (en rojo). Es lo primero que ves al abrir la app.
- **Próximos, Todos y Hechos:** pendientes futuros por fecha, todo agrupado por categoría, y lo que ya terminaste.
- **Número en el ícono:** el ícono muestra cuántos pendientes tienes hoy, como el globito rojo de Mensajes.
- **Recordatorios:** avisos en el centro de notificaciones (lee la sección de abajo).
- **Sin internet:** después de la primera vez, abre aunque no tengas conexión.
- **Privacidad:** tus pendientes se guardan solo en tu teléfono.

## Paso 1: publicarla gratis en internet (una sola vez, desde tu computadora)

El iPhone solo puede instalar la app desde una dirección `https://`. GitHub Pages lo hace gratis:

1. Crea una cuenta en <https://github.com> si no tienes una.
2. Toca **+ › New repository**. Nómbralo `pendientes`, déjalo en **Public** y toca **Create repository**.
3. En la página del repositorio, toca **uploading an existing file**.
4. Arrastra **todo el contenido** de la carpeta `pendientes`: `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest` y la carpeta `icons`. Toca **Commit changes**.
5. Ve a **Settings › Pages**. En *Branch* elige `main` y `/ (root)` y toca **Save**.
6. Espera 1 o 2 minutos. Tu app quedará en `https://TU-USUARIO.github.io/pendientes/`.

> Como el repositorio es público, el código se puede ver. **Tus pendientes no**: esos nunca salen de tu teléfono.

## Paso 2: instalarla en el iPhone

1. Abre la dirección de tu app en **Safari** (tiene que ser Safari).
2. Toca el botón **Compartir** (el cuadro con flecha hacia arriba).
3. Toca **Agregar a inicio** y luego **Agregar**.
4. Abre la app **desde el ícono nuevo** y úsala siempre desde ahí. Lo que guardes en Safari y lo que guardes en el ícono son espacios separados.

## Paso 3: activar avisos y el número en el ícono

1. Desde la app instalada, toca **⚙︎ › Activar avisos** y luego **Permitir**.
2. Listo: el ícono mostrará cuántos pendientes tienes hoy.

Requiere iOS 16.4 o más reciente (Configuración › General › Información).

## Cómo funcionan los recordatorios (importante)

En el iPhone, una app web **no puede programar avisos que lleguen con la app totalmente cerrada**. Apple solo lo permite con un servidor de notificaciones. Por eso hay dos niveles:

| Situación | Qué pasa |
|---|---|
| App abierta o recién usada (en segundo plano) | Te llega el aviso a la hora del recordatorio. |
| App cerrada cuando llega la hora | Al abrirla, ves el recordatorio que se te pasó. |
| **Quieres avisos seguros siempre** | Usa **📅 Enviar al Calendario** (dentro de un pendiente, o en Ajustes para enviar todos). El Calendario del iPhone te avisa a la hora exacta aunque la app esté cerrada. |

Cuando tocas *Enviar al Calendario* se abre el menú Compartir del iPhone. Elige **Calendario** si aparece. Si no aparece, elige **Guardar en Archivos**, abre el archivo desde la app Archivos y toca **Agregar todo**.

### Bonus: ver los pendientes del día en la pantalla de inicio

Las apps web no pueden tener widget propio, pero el **widget de Calendario** de Apple sí muestra lo que envíes al Calendario. Mantén presionada la pantalla de inicio, toca **+**, busca **Calendario** y agrega el widget **Siguiente** o **Lista**.

## Respaldo

Tus datos viven solo en el teléfono. Si borras la app del inicio, se borran. Usa **⚙︎ › Descargar respaldo** de vez en cuando, y **Restaurar** para recuperarlos.

## Actualizar la app

Si cambias algún archivo, súbelo otra vez al mismo repositorio de GitHub. La app toma la versión nueva la próxima vez que la abras con internet.
