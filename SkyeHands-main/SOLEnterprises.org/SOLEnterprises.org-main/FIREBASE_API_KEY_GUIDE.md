# 🔑 How to Find Your Firebase API Key

## Step-by-Step Instructions:

### Option 1: Firebase Console (Recommended)

1. **Go to Firebase Console**: https://console.firebase.google.com/

2. **Select Your Project**: Click on `solenterprises-58215`

3. **Open Project Settings**:
   - Click the ⚙️ gear icon next to "Project Overview" (top left)
   - Select "Project settings" from the dropdown

4. **Scroll Down to "Your apps"**:
   - You should see a web app icon `</>`
   - If you see your web app listed, click on it

5. **Find the Config Object**:
   - You'll see a code block like this:
   ```javascript
    const firebaseConfig = {
       apiKey: "YOUR_FIREBASE_API_KEY_HERE",  // <-- Set via Netlify env var, do not commit real key
       authDomain: "solenterprises-58215.firebaseapp.com",
       projectId: "solenterprises-58215",
       storageBucket: "solenterprises-58215.appspot.com",
       messagingSenderId: "287667620838",
       appId: "1:287667620838:web:..."
    };
   ```

6. **Copy the `apiKey` value** (it starts with `AIza` and is about 39 characters long, but do not commit it to your repo)

---

### Option 2: If You Don't See a Web App

If you don't see a web app in your project:

1. In Project Settings, scroll down to **"Your apps"**
2. Click the `</>` (web) icon to **"Add app"**
3. Give it a nickname like "SOL Website"
4. Click **"Register app"**
5. You'll see the config with your API key
6. Copy the `apiKey` value

---

### Option 3: Using Firebase CLI (Alternative)

If you have Firebase CLI installed, run:
```bash
firebase apps:sdkconfig web
```

This will display your config with the API key.

---

## ⚠️ Important Notes:

// The API key starts with `AIza` and is about 39 characters long
// Example format: `AIzaSyD1234567890abcdefghijklmnopqrstuvw`
- This is NOT the same as your OpenAI API key (which starts with `sk-`)
- Firebase API keys are safe to use in client-side code (they're meant to be public)

---

## 🔧 Once You Have the Key:

- Set the `FIREBASE_API_KEY` environment variable in Netlify (Site settings → Build & deploy → Environment).
- For local testing with `netlify dev`, add it to your `.env` file instead of committing it.
- The client loads the key at runtime from `/.netlify/functions/firebase-config`, so no static HTML or repo files should contain the value.

---

## 🆘 Still Can't Find It?

Let me know and I can:
1. Help you create a new Firebase web app
2. Guide you through the Firebase CLI setup
3. Check if there are authentication restrictions on your project
