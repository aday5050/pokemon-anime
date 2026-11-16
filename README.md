# Pokédex Anime

Guía de episodios de la serie de Ash, con búsqueda por título o número, filtros por temporada y clasificación de historia o relleno. El catálogo está en `src/data/pokemon_episodes.json`. La aplicación está construida con React y Vite.

## Desarrollo

Necesitas Node.js 20.19+ o 22.12+ y npm.

```sh
npm ci
npm run dev
```

Abre la dirección que muestra Vite. El catálogo se puede consultar sin configurar Firebase; el inicio de sesión y el progreso en la nube requieren la configuración siguiente.

## Inicio de sesión y progreso

1. Crea un proyecto de Firebase y una aplicación web. Habilita Google como proveedor en Authentication y crea una base de datos Firestore.
2. Copia `.env.example` a `.env.local` y completa los valores de configuración de la aplicación web de Firebase. Reinicia Vite después de cambiarlos. Las variables `VITE_` se incluyen en el cliente: no pongas secretos en ellas.
3. Añade los dominios que utilizarás a los dominios autorizados de Firebase Authentication.
4. Configura reglas de Firestore que solo permitan a cada usuario autenticado leer y escribir su propio documento de `user_progress`. Por ejemplo:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /user_progress/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Estas reglas deben publicarse en tu propio proyecto de Firebase. El progreso depende de la disponibilidad y configuración de Firebase.

## Reproducción y despliegue

El reproductor utiliza HLS y depende de los archivos de un servicio externo, cuya disponibilidad y estructura pueden cambiar. En desarrollo, Vite dirige `/pkvideo` a ese servicio; en Vercel, `vercel.json` dirige las peticiones a `api/proxy.js`. La reproducción real depende también de que el proveedor permita el acceso y de las condiciones de uso aplicables.

```sh
npm run lint
npm test
npm run build
npm run preview
```

`npm run preview` sirve la compilación de Vite, pero no ejecuta las funciones de Vercel; para probar el proxy de producción se necesita un entorno compatible con Vercel.
