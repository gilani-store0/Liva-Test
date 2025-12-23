// ⚠️ تحذير مهم: استبدل هذه البيانات ببيانات مشروعك على Firebase

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
let db, auth;

try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    auth = firebase.auth();
} catch (error) {
    console.error('Firebase initialization error:', error);
}

export { db, auth };