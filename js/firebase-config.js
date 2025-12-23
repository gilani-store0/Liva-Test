// إعدادات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBxf1p2qQVzICE82JcBwWaX5ZwUkyUDars",
  authDomain: "store-d35a6.firebaseapp.com",
  projectId: "store-d35a6",
  storageBucket: "store-d35a6.appspot.com",
  messagingSenderId: "1051631059028",
  appId: "1:1051631059028:web:8a66b15f4a303d7c1fadc1"
};

// تشغيل Firebase
firebase.initializeApp(firebaseConfig);

// متغيرات عامة
window.db = firebase.firestore();
window.auth = firebase.auth();