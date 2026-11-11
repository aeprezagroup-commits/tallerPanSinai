# Guía de Conexión y Despliegue en Firebase
## Sistema Web de Control y Registro - Taller Mecánico Pan Sinaí

La aplicación ya está completamente desarrollada y funcional. Actualmente incluye un modo local demostrativo con datos precargados para que puedas probar todas las funciones (creación de órdenes, asignación de mecánicos, cronómetro de trabajo, cambio de estados, subida de fotos y cierre de órdenes).

---

### Paso 1: Crear el Proyecto en Firebase Console
1. Ingresa a [Firebase Console](https://console.firebase.google.com/) con tu cuenta de Google.
2. Haz clic en **"Crear un proyecto"** (o "Add project") y nómbralo `taller-pan-sinai` (o el nombre que prefieras).
3. Desactiva o activa Google Analytics según tu preferencia y crea el proyecto.

---

### Paso 2: Habilitar Firestore Database y Storage

#### A. Firestore Database (Base de datos en tiempo real)
1. En el menú lateral izquierdo, ve a **Compilación (Build)** > **Firestore Database**.
2. Haz clic en **"Crear base de datos"**.
3. Selecciona la ubicación más cercana (por ejemplo `nam5 (us-central)`).
4. Elige **"Comenzar en modo de prueba"** (para desarrollo) o configura las siguientes reglas de lectura y escritura:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true; // En producción, puedes añadir autenticación si lo requieres
       }
     }
   }
   ```

#### B. Firebase Storage (Para las fotografías de los vehículos)
1. En el menú lateral, ve a **Compilación** > **Storage**.
2. Haz clic en **"Comenzar"**, acepta la ubicación predeterminada y elige modo prueba:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if true;
       }
     }
   }
   ```

---

### Paso 3: Obtener las Credenciales de la Aplicación Web
1. En la página principal del proyecto Firebase, haz clic en el ícono de **Web (</>)**.
2. Registra la aplicación con el apodo `Pan Sinai Web`.
3. Copia el objeto `firebaseConfig` que te entrega Firebase:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "taller-pan-sinai.firebaseapp.com",
     projectId: "taller-pan-sinai",
     storageBucket: "taller-pan-sinai.appspot.com",
     messagingSenderId: "123456789...",
     appId: "1:123456789:web:abcdef..."
   };
   ```
4. Abre el archivo [`src/firebase/config.js`](file:///c:/Users/MINEDUCYT/Desktop/API-Sinai/src/firebase/config.js) en este proyecto y reemplaza los valores de `firebaseConfig`.

¡Listo! Al guardar el archivo, la plataforma dejará el modo local y sincronizará en tiempo real con la nube de Firebase.

---

### Paso 4: Despliegue en Firebase Hosting (Poner en línea)
Si deseas alojar la aplicación web directamente en Firebase Hosting para que el personal de Pan Sinaí acceda desde cualquier celular o PC:

1. Instala Firebase CLI en tu terminal:
   ```bash
   npm install -g firebase-tools
   ```
2. Inicia sesión en Firebase:
   ```bash
   firebase login
   ```
3. Inicializa el proyecto en esta carpeta:
   ```bash
   firebase init hosting
   ```
   - Selecciona **"Use an existing project"** y elige tu proyecto de Firebase.
   - En **"What do you want to use as your public directory?"** escribe: `dist`
   - En **"Configure as a single-page app (rewrite all urls to /index.html)?"** responde: `Yes`
   - En **"Set up automatic builds and deploys with GitHub?"** responde: `No` (o Sí si usas GitHub Actions).

4. Construye y despliega la aplicación:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

Firebase te entregará tu URL pública (ejemplo: `https://taller-pan-sinai.web.app`) lista para usarse e instalarse como PWA en smartphones y tablets.
