const { app, BrowserWindow } = require("electron")
const path = require("path")

function createWindow() {
 const win = new BrowserWindow({
  width: 1500,
  height: 950,
  autoHideMenuBar: true,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
  },
})

  win.loadFile(path.join(__dirname, "dist", "index.html"))
 
}

app.whenReady().then(createWindow)

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})