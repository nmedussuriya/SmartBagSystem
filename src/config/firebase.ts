import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getDatabase, 
  Database, 
  ref, 
  set, 
  push, 
  onValue, 
  update, 
  remove,
  get,
  child
} from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBnPVnXOMMCK4tUC5H3uiqwbBWfr9qUsJs",
  authDomain: "smartschoolbag-b06c5.firebaseapp.com",
  databaseURL: "https://smartschoolbag-b06c5-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smartschoolbag-b06c5",
  storageBucket: "smartschoolbag-b06c5.firebasestorage.app",
  messagingSenderId: "184103700673",
  appId: "1:184103700673:web:162ffc54f2c259bef8ac40"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
const database: Database = getDatabase(app);
const auth: Auth = getAuth(app);

// Export all Firebase services
export { 
  database, 
  auth, 
  ref, 
  set, 
  push, 
  onValue, 
  update, 
  remove,
  get,
  child
};