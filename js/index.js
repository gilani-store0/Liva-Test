import { v4 as uuidv4 } from 'uuid';

// Export uuidv4 so it can be used in main.js
window.uuidv4 = uuidv4;

// Load main application logic
import './main.js';
