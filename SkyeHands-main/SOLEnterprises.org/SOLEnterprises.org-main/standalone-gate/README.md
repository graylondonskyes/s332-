# SOLE Gateway - Standalone Version

This folder contains a **fully self-contained** version of your SOLE access gate.

## 📁 What's Included

- `index.html` - Complete standalone gate page with all styles and scripts inline

## ✨ Features

- ✅ Full cosmic gradient background
- ✅ Two-column glassmorphic panel design
- ✅ Status chips and visual elements
- ✅ Firebase authentication integration
- ✅ Session management (remembers unlocked state)
- ✅ Silent failure on wrong key
- ✅ Welcome confirmation on correct key
- ✅ "RETURN to THE SOLE" button
- ✅ "ESTIFARR'S GATE" title section

## 🔑 Configuration

### Access Key
Current key: `444666`

To change it, edit line 474 in `index.html`:
```javascript
const CORRECT_KEY = "444666"; // Change this
```

### Redirect URL
Current redirect: `/PagesSOLEHomepage.html`

To change where users go after unlocking, edit line 475:
```javascript
const NEXT_URL = "/PagesSOLEHomepage.html"; // Change this
```

### Firebase Config
Firebase is already configured with your project credentials.

If you need to update Firebase settings, edit the `firebaseConfig` object starting at line 463.

## 🚀 Usage

### Option 1: Use as Main Landing Page
Replace your root `index.html` with this one.

### Option 2: Use as Standalone Gate
1. Upload this folder to any web host
2. Users visit this page first
3. After unlocking, they're redirected to your main site

### Option 3: Embed in Existing Site
Copy the HTML content into your existing page structure.

## 🔧 Customization

All styles are contained in the `<style>` block. Key variables:

```css
--vio: #7c3aed;    /* Purple */
--mag: #ff3df0;    /* Magenta */
--cyan: #2ef6ff;   /* Cyan */
--gold: #ffcc55;   /* Gold */
```

## 📝 Notes

- **No external dependencies** - Everything is self-contained
- **Session storage** - Gate remembers unlock state per browser tab
- **Firebase CDN** - Uses Firebase v12.7.0 from CDN
- **Mobile responsive** - Adapts to all screen sizes
- **Silent failure** - Wrong keys don't show error messages (as designed)

## 🌐 Testing Locally

```bash
# From the standalone-gate folder
python -m http.server 8000
# Then visit: http://localhost:8000
```

Or use any local server (Live Server extension, etc.)

---

**Created for SOLEnterprises.org**
Firebase Project: `solenterprises-58215`
