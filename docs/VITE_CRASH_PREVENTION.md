# Vite + Extension Crash Prevention

## ✅ Defensive Fixes Applied

### 1. HMR Overlay Disabled

**File:** `client/vite.config.ts`

**Change:**
```typescript
server: {
  hmr: {
    overlay: false, // Disable HMR overlay to prevent browser extension crashes
  },
}
```

**Why:**
- Browser extensions can interfere with Vite's HMR overlay
- Disabling overlay prevents "disconnected port object" errors
- Reduces conflicts with extension message passing

---

## 🔄 Manual Steps Required

### Restart Dev Server

**Steps:**
1. Stop the current dev server:
   - Press `Ctrl + C` in the terminal running `npm run dev`
   - Or close the terminal window

2. Restart the dev server:
   ```bash
   cd client
   npm run dev
   ```

**Why:**
- Ensures new Vite config is loaded
- Clears any cached HMR connections
- Fresh start prevents extension interference

---

## 🛡️ Additional Defensive Measures

### Already Implemented

1. **Native File Inputs:**
   - Products and Sales imports use native `<input type="file">`
   - No browser extension APIs (`window.postMessage`, `chrome.runtime`, etc.)
   - Safe React file upload flow

2. **Direct API Calls:**
   - Uses `fetch` and `axios` directly
   - No custom proxy scripts
   - No extension message passing

3. **Error Handling:**
   - Try/catch blocks around file operations
   - Graceful error handling
   - User-friendly error messages

---

## 📝 Notes

- **HMR Overlay:** Disabled to prevent extension conflicts
- **File Uploads:** Use native browser APIs only
- **No Extension APIs:** Avoids `window.postMessage` and similar
- **Safe Patterns:** All file operations use standard React patterns

---

## ✅ Status

- ✅ HMR overlay disabled in `vite.config.ts`
- ⏳ **Manual:** Restart dev server required
- ✅ File uploads use safe patterns
- ✅ No extension APIs used

**Next Step:** Restart the dev server to apply changes.
