// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// IMPORTANT: Replace with your own Firebase configuration and secure your Firestore rules.
// See: https://firebase.google.com/docs/web/setup
// And: https://firebase.google.com/docs/firestore/security/get-started
const firebaseConfig = {"apiKey":"AIzaSyA21c8G1c73a6vJ5Vd6-wh4e3d551ec9a3b836c7","authDomain":"pharma-flash-34881.firebaseapp.com","projectId":"pharma-flash-34881","storageBucket":"pharma-flash-34881.appspot.com","messagingSenderId":"1029810852153","appId":"1:1029810852153:web:2121764614a9354142f451"};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
