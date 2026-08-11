# SnapPix 📸

**SnapPix** es una aplicación web estilo TikTok orientada exclusivamente a la publicación, descubrimiento e interacción con **fotografías e imágenes** mediante un feed vertical de desplazamiento continuo. 

Desarrollada totalmente con el stack web estándar (HTML5, CSS3 y JavaScript vanilla) e integrada con **Firebase** para el backend Serverless.

---

## ⚡ Características Principales

* **Feed Vertical Infinito:** Navegación a pantalla completa mediante `scroll-snap` optimizada para dispositivos móviles y escritorio.
* **Carga de Imágenes:** Subida rápida de archivos locales guardados e indexados directamente en la nube.
* **Autenticación de Usuarios:** Registro e inicio de sesión seguro (Email/Password o Google) a través de Firebase Auth.
* **Interacción en Tiempo Real:** Sistema de likes, guardados y contador de vistas almacenados al instante.
* **Perfil de Usuario:** Galería personal con el historial de publicaciones subidas por el creador.

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
| :--- | :--- |
| **Estructura** | HTML5 Semántico |
| **Estilos** | CSS3 (Flexbox, Grid, CSS Scroll Snap, Variables CSS) |
| **Lógica / Frontend** | JavaScript Vanilla (ES6+ Modules) |
| **Base de Datos** | Cloud Firestore (Tiempo real) |
| **Almacenamiento** | Firebase Storage (Imágenes) |
| **Autenticación** | Firebase Authentication |
| **Hosting** | Firebase Hosting |

---

## 📁 Estructura del Proyecto

```text
snappix/
├── index.html            # Pantalla principal (Feed)
├── profile.html          # Vista de perfil del usuario
├── upload.html           # Interfaz para subida de imágenes
├── css/
│   ├── main.css          # Estilos globales y layout vertical
│   └── components.css    # Estilos de botones, cards e interacciones
├── js/
│   ├── firebase-config.js # Credenciales e inicialización de Firebase
│   ├── auth.js           # Gestión de sesiones y registro
│   ├── feed.js           # Renderizado dinámico del feed y scroll
│   └── upload.js         # Subida de imágenes a Firebase Storage
└── assets/               # Íconos y recursos estáticos
