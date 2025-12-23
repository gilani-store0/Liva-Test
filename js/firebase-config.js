// ⚠️ تحذير مهم: استبدل هذه البيانات ببيانات مشروعك على Firebase
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBxf1p2qQVzICE82JcBwWaX5ZwUkyUDars",
  authDomain: "store-d35a6.firebaseapp.com",
  projectId: "store-d35a6",
  storageBucket: "store-d35a6.firebasestorage.app",
  messagingSenderId: "1051631059028",
  appId: "1:1051631059028:web:8a66b15f4a303d7c1fadc1",
  measurementId: "G-KKYLLH29DL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);