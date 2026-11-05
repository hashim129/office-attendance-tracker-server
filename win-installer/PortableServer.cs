using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("Office Attendance Tracker - Local Server")]
[assembly: AssemblyDescription("Standalone Windows Local Office Attendance Server & Desktop Application")]
[assembly: AssemblyCompany("Apex Technologies Ltd.")]
[assembly: AssemblyProduct("Office Attendance Tracker")]
[assembly: AssemblyVersion("2.4.0.0")]
[assembly: AssemblyFileVersion("2.4.0.0")]

namespace OfficeAttendanceServer
{
    public class MainForm : Form
    {
        private TcpListener _listener;
        private Thread _serverThread;
        private volatile bool _isRunning = false;
        private int _port = 3000;
        private string _lanIp = "127.0.0.1";
        private string _dataDir;
        private string _dbFilePath;
        private readonly object _dbLock = new object();

        // Embedded web assets loaded into memory
        private Dictionary<string, byte[]> _assets = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
        private Dictionary<string, string> _mimeTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        // UI Controls
        private Label _statusLabel;
        private TextBox _localUrlBox;
        private TextBox _lanUrlBox;
        private TextBox _logBox;
        private CheckBox _autoStartCheck;
        private NotifyIcon _trayIcon;
        private ContextMenu _trayMenu;

        public MainForm(bool startMinimized)
        {
            InitializeDataFolder();
            LoadEmbeddedWebAssets();
            DetectLanIp();
            SetupUi();
            SetupTrayIcon();
            StartHttpServer();

            if (startMinimized)
            {
                this.WindowState = FormWindowState.Minimized;
                this.ShowInTaskbar = false;
            }
            else
            {
                // Automatically open the desktop web window on launch
                ThreadPool.QueueUserWorkItem(_ =>
                {
                    Thread.Sleep(600);
                    this.BeginInvoke((Action)(() => OpenAppWindow(false)));
                });
            }
        }

        private void InitializeDataFolder()
        {
            string exeDir = Path.GetDirectoryName(Application.ExecutablePath);
            try
            {
                string localData = Path.Combine(exeDir, "data");
                Directory.CreateDirectory(localData);
                string testFile = Path.Combine(localData, ".write_test");
                File.WriteAllText(testFile, "ok");
                File.Delete(testFile);
                _dataDir = localData;
            }
            catch
            {
                _dataDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "OfficeAttendanceTracker",
                    "data"
                );
                Directory.CreateDirectory(_dataDir);
            }
            _dbFilePath = Path.Combine(_dataDir, "database.json");
        }

        private void LoadEmbeddedWebAssets()
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            Stream zipStream = asm.GetManifestResourceStream("WebAssets.zip");
            if (zipStream != null)
            {
                using (ZipArchive archive = new ZipArchive(zipStream, ZipArchiveMode.Read))
                {
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        if (string.IsNullOrEmpty(entry.Name)) continue;
                        string relPath = "/" + entry.FullName.Replace('\\', '/').TrimStart('/');
                        using (Stream entryStream = entry.Open())
                        using (MemoryStream ms = new MemoryStream())
                        {
                            entryStream.CopyTo(ms);
                            _assets[relPath] = ms.ToArray();
                            _mimeTypes[relPath] = GetMimeType(relPath);
                        }
                    }
                }
            }
        }

        private static string GetMimeType(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            switch (ext)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".js": return "application/javascript; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".svg": return "image/svg+xml";
                case ".png": return "image/png";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".ico": return "image/x-icon";
                case ".woff": return "font/woff";
                case ".woff2": return "font/woff2";
                default: return "application/octet-stream";
            }
        }

        private void DetectLanIp()
        {
            try
            {
                foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.OperationalStatus != OperationalStatus.Up) continue;
                    if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                    foreach (UnicastIPAddressInformation ip in ni.GetIPProperties().UnicastAddresses)
                    {
                        if (ip.Address.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip.Address))
                        {
                            _lanIp = ip.Address.ToString();
                            return;
                        }
                    }
                }
            }
            catch { }
        }

        private void SetupUi()
        {
            this.Text = "Office Attendance Tracker — Local Windows Server v2.4";
            this.Size = new Size(700, 560);
            this.MinimumSize = new Size(660, 520);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(15, 23, 42);
            this.ForeColor = Color.White;
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            this.Icon = SystemIcons.Application;

            // Header Panel
            Panel header = new Panel
            {
                Dock = DockStyle.Top,
                Height = 76,
                BackColor = Color.FromArgb(30, 41, 59),
                Padding = new Padding(20, 14, 20, 14)
            };

            Label titleLbl = new Label
            {
                Text = "Office Attendance Tracker — Windows Local Server",
                Font = new Font("Segoe UI Semibold", 13.5f, FontStyle.Bold),
                ForeColor = Color.White,
                AutoSize = true,
                Location = new Point(20, 14)
            };

            _statusLabel = new Label
            {
                Text = "● Starting Server...",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(52, 211, 153),
                AutoSize = true,
                Location = new Point(22, 44)
            };

            header.Controls.Add(titleLbl);
            header.Controls.Add(_statusLabel);
            this.Controls.Add(header);

            // Body Container
            Panel body = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(22)
            };

            int y = 90;

            // URLs Section
            Label localLbl = new Label
            {
                Text = "Host PC Address (Local):",
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(22, y),
                AutoSize = true
            };
            body.Controls.Add(localLbl);

            _localUrlBox = new TextBox
            {
                ReadOnly = true,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(56, 189, 248),
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Consolas", 10.5f, FontStyle.Bold),
                Location = new Point(22, y + 22),
                Size = new Size(300, 28)
            };
            body.Controls.Add(_localUrlBox);

            Label lanLbl = new Label
            {
                Text = "Office LAN Address (Share with Staff PCs):",
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(345, y),
                AutoSize = true
            };
            body.Controls.Add(lanLbl);

            _lanUrlBox = new TextBox
            {
                ReadOnly = true,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(52, 211, 153),
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Consolas", 10.5f, FontStyle.Bold),
                Location = new Point(345, y + 22),
                Size = new Size(310, 28)
            };
            body.Controls.Add(_lanUrlBox);

            y += 66;

            // Primary Action Buttons
            Button openDesktopBtn = CreateButton("Open Attendance App Window", Color.FromArgb(37, 99, 235), new Point(22, y), new Size(205, 40));
            openDesktopBtn.Click += (s, e) => OpenAppWindow(false);
            body.Controls.Add(openDesktopBtn);

            Button openBrowserBtn = CreateButton("Open in Web Browser", Color.FromArgb(51, 65, 85), new Point(238, y), new Size(200, 40));
            openBrowserBtn.Click += (s, e) => Process.Start(string.Format("http://localhost:{0}", _port));
            body.Controls.Add(openBrowserBtn);

            Button copyLanBtn = CreateButton("Copy Office LAN Link", Color.FromArgb(51, 65, 85), new Point(450, y), new Size(205, 40));
            copyLanBtn.Click += (s, e) =>
            {
                Clipboard.SetText(_lanUrlBox.Text);
                AppendLog("Copied LAN URL to clipboard: " + _lanUrlBox.Text);
                MessageBox.Show("Office LAN URL copied to clipboard:\n\n" + _lanUrlBox.Text + "\n\nAny computer or tablet on your office Wi-Fi/LAN can open this address.", "LAN Link Copied", MessageBoxButtons.OK, MessageBoxIcon.Information);
            };
            body.Controls.Add(copyLanBtn);

            y += 50;

            Button openDataBtn = CreateButton("Open Local Database Folder", Color.FromArgb(30, 41, 59), new Point(22, y), new Size(205, 34));
            openDataBtn.Click += (s, e) => Process.Start("explorer.exe", _dataDir);
            body.Controls.Add(openDataBtn);

            Button firewallBtn = CreateButton("Enable LAN Firewall Rule", Color.FromArgb(30, 41, 59), new Point(238, y), new Size(200, 34));
            firewallBtn.Click += (s, e) => ConfigureFirewallRule();
            body.Controls.Add(firewallBtn);

            Button hideTrayBtn = CreateButton("Minimize to System Tray", Color.FromArgb(30, 41, 59), new Point(450, y), new Size(205, 34));
            hideTrayBtn.Click += (s, e) =>
            {
                this.Hide();
                _trayIcon.ShowBalloonTip(2000, "Attendance Server Running", "The local attendance server continues running in the background.", ToolTipIcon.Info);
            };
            body.Controls.Add(hideTrayBtn);

            y += 46;

            // Auto-start checkbox
            _autoStartCheck = new CheckBox
            {
                Text = "Automatically start Attendance Server when Windows logs in",
                ForeColor = Color.FromArgb(203, 213, 225),
                Location = new Point(22, y),
                AutoSize = true,
                Checked = IsAutoStartEnabled()
            };
            _autoStartCheck.CheckedChanged += (s, e) => SetAutoStart(_autoStartCheck.Checked);
            body.Controls.Add(_autoStartCheck);

            y += 32;

            // Activity Log
            Label logLbl = new Label
            {
                Text = "Live Server Activity & Database Log:",
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(22, y),
                AutoSize = true
            };
            body.Controls.Add(logLbl);

            _logBox = new TextBox
            {
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Vertical,
                BackColor = Color.FromArgb(9, 14, 26),
                ForeColor = Color.FromArgb(167, 243, 208),
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Consolas", 9f),
                Location = new Point(22, y + 22),
                Size = new Size(633, 155),
                Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right
            };
            body.Controls.Add(_logBox);

            this.Controls.Add(body);

            this.FormClosing += (s, e) =>
            {
                StopHttpServer();
                if (_trayIcon != null) _trayIcon.Visible = false;
            };
        }

        private Button CreateButton(string text, Color bg, Point location, Size size)
        {
            Button btn = new Button
            {
                Text = text,
                BackColor = bg,
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Location = location,
                Size = size,
                Cursor = Cursors.Hand,
                Font = new Font("Segoe UI Semibold", 9f, FontStyle.Bold)
            };
            btn.FlatAppearance.BorderColor = Color.FromArgb(71, 85, 105);
            btn.FlatAppearance.BorderSize = 1;
            return btn;
        }

        private void SetupTrayIcon()
        {
            _trayMenu = new ContextMenu();
            _trayMenu.MenuItems.Add("Open Control Panel", (s, e) => { this.Show(); this.WindowState = FormWindowState.Normal; this.Activate(); });
            _trayMenu.MenuItems.Add("Open Attendance App", (s, e) => OpenAppWindow(false));
            _trayMenu.MenuItems.Add("-");
            _trayMenu.MenuItems.Add("Exit Server", (s, e) => Application.Exit());

            _trayIcon = new NotifyIcon
            {
                Text = "Office Attendance Tracker Server",
                Icon = SystemIcons.Application,
                ContextMenu = _trayMenu,
                Visible = true
            };
            _trayIcon.DoubleClick += (s, e) => { this.Show(); this.WindowState = FormWindowState.Normal; this.Activate(); };
        }

        private void OpenAppWindow(bool kiosk)
        {
            string url = string.Format("http://localhost:{0}", _port);
            try
            {
                // Try launching Microsoft Edge or Chrome in native chromeless app mode for true Windows desktop experience
                string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
                string edgePath64 = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
                string targetBrowser = File.Exists(edgePath) ? edgePath : (File.Exists(edgePath64) ? edgePath64 : null);

                if (targetBrowser != null)
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = targetBrowser,
                        Arguments = string.Format("--app={0} --window-size=1360,860", url),
                        UseShellExecute = true
                    });
                    AppendLog("Launched native Windows Desktop App Window (" + url + ")");
                    return;
                }
            }
            catch { }

            try
            {
                Process.Start(url);
                AppendLog("Opened application in default browser (" + url + ")");
            }
            catch { }
        }

        private void ConfigureFirewallRule()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "netsh",
                    Arguments = string.Format("advfirewall firewall add rule name=\"Office Attendance Tracker\" dir=in action=allow protocol=TCP localport={0}", _port),
                    Verb = "runas",
                    UseShellExecute = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                Process p = Process.Start(psi);
                if (p != null) p.WaitForExit(5000);
                AppendLog("Configured Windows Firewall inbound rule for TCP port " + _port);
                MessageBox.Show("Windows Firewall rule added for port " + _port + ".\nAll office devices on your network can now connect.", "Firewall Updated", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                AppendLog("Firewall rule cancelled or failed: " + ex.Message);
            }
        }

        private bool IsAutoStartEnabled()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", false))
                {
                    return key != null && key.GetValue("OfficeAttendanceTracker") != null;
                }
            }
            catch { return false; }
        }

        private void SetAutoStart(bool enable)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    if (key == null) return;
                    if (enable)
                    {
                        key.SetValue("OfficeAttendanceTracker", "\"" + Application.ExecutablePath + "\" --minimized");
                        AppendLog("Enabled automatic startup with Windows.");
                    }
                    else
                    {
                        key.DeleteValue("OfficeAttendanceTracker", false);
                        AppendLog("Disabled automatic startup with Windows.");
                    }
                }
            }
            catch (Exception ex)
            {
                AppendLog("Failed to update startup setting: " + ex.Message);
            }
        }

        private void StartHttpServer()
        {
            for (int p = 3000; p <= 3010; p++)
            {
                try
                {
                    _listener = new TcpListener(IPAddress.Any, p);
                    _listener.Start();
                    _port = p;
                    _isRunning = true;
                    break;
                }
                catch
                {
                    _listener = null;
                }
            }

            if (!_isRunning)
            {
                _statusLabel.Text = "● ERROR: Could not bind port 3000-3010";
                _statusLabel.ForeColor = Color.FromArgb(248, 113, 113);
                return;
            }

            string localUrl = string.Format("http://localhost:{0}", _port);
            string lanUrl = string.Format("http://{0}:{1}", _lanIp, _port);

            _localUrlBox.Text = localUrl;
            _lanUrlBox.Text = lanUrl;
            _statusLabel.Text = string.Format("● SERVER ACTIVE — Listening on Port {0} (LAN & Localhost)", _port);

            AppendLog("Server started on " + localUrl + " and " + lanUrl);
            AppendLog("Database file path: " + _dbFilePath);
            AppendLog(string.Format("Loaded {0} embedded web assets into memory.", _assets.Count));

            _serverThread = new Thread(AcceptLoop) { IsBackground = true };
            _serverThread.Start();
        }

        private void StopHttpServer()
        {
            _isRunning = false;
            try { if (_listener != null) _listener.Stop(); } catch { }
        }

        private void AcceptLoop()
        {
            while (_isRunning)
            {
                try
                {
                    TcpClient client = _listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(HandleClient, client);
                }
                catch
                {
                    if (!_isRunning) break;
                }
            }
        }

        private void HandleClient(object obj)
        {
            using (TcpClient client = (TcpClient)obj)
            {
                try
                {
                    client.ReceiveTimeout = 10000;
                    client.SendTimeout = 10000;
                    using (NetworkStream stream = client.GetStream())
                    {
                        // Read HTTP headers
                        List<byte> headerBytes = new List<byte>();
                        int b;
                        while ((b = stream.ReadByte()) != -1)
                        {
                            headerBytes.Add((byte)b);
                            int count = headerBytes.Count;
                            if (count >= 4 &&
                                headerBytes[count - 4] == '\r' &&
                                headerBytes[count - 3] == '\n' &&
                                headerBytes[count - 2] == '\r' &&
                                headerBytes[count - 1] == '\n')
                            {
                                break;
                            }
                            if (count > 32768) break;
                        }

                        if (headerBytes.Count == 0) return;

                        string headerStr = Encoding.ASCII.GetString(headerBytes.ToArray());
                        string[] lines = headerStr.Split(new[] { "\r\n" }, StringSplitOptions.None);
                        if (lines.Length == 0) return;

                        string[] reqParts = lines[0].Split(' ');
                        if (reqParts.Length < 2) return;

                        string method = reqParts[0].ToUpperInvariant();
                        string rawUrl = reqParts[1];
                        string path = rawUrl.Split('?')[0];

                        int contentLength = 0;
                        foreach (string line in lines)
                        {
                            if (line.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase))
                            {
                                int.TryParse(line.Substring(15).Trim(), out contentLength);
                            }
                        }

                        byte[] bodyBytes = new byte[0];
                        if (contentLength > 0 && contentLength < 20 * 1024 * 1024)
                        {
                            bodyBytes = new byte[contentLength];
                            int totalRead = 0;
                            while (totalRead < contentLength)
                            {
                                int r = stream.Read(bodyBytes, totalRead, contentLength - totalRead);
                                if (r <= 0) break;
                                totalRead += r;
                            }
                        }

                        // Route: GET /api/my-ip
                        if (path.Equals("/api/my-ip", StringComparison.OrdinalIgnoreCase) && method == "GET")
                        {
                            string remoteIp = "127.0.0.1";
                            try
                            {
                                IPEndPoint ep = client.Client.RemoteEndPoint as IPEndPoint;
                                if (ep != null) remoteIp = ep.Address.ToString();
                            }
                            catch { }
                            string ipJson = string.Format("{{\"ip\":\"{0}\"}}", remoteIp);
                            WriteResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(ipJson));
                            return;
                        }

                        // Route: GET /api/db
                        if (path.Equals("/api/db", StringComparison.OrdinalIgnoreCase) && method == "GET")
                        {
                            string json = "{\"empty\":true}";
                            lock (_dbLock)
                            {
                                if (File.Exists(_dbFilePath))
                                {
                                    json = File.ReadAllText(_dbFilePath, Encoding.UTF8);
                                }
                            }
                            WriteResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(json));
                            return;
                        }

                        // Route: POST /api/db
                        if (path.Equals("/api/db", StringComparison.OrdinalIgnoreCase) && method == "POST")
                        {
                            string jsonBody = Encoding.UTF8.GetString(bodyBytes);
                            lock (_dbLock)
                            {
                                File.WriteAllText(_dbFilePath, jsonBody, Encoding.UTF8);
                            }
                            AppendLog("Synchronized attendance database from client (" + bodyBytes.Length + " bytes)");
                            WriteResponse(stream, "200 OK", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"ok\":true}"));
                            return;
                        }

                        // Route: GET /downloads/*.exe
                        if (path.StartsWith("/downloads/", StringComparison.OrdinalIgnoreCase))
                        {
                            string fileName = Path.GetFileName(path);
                            string exeDir = Path.GetDirectoryName(Application.ExecutablePath);
                            string candidate = Path.Combine(exeDir, fileName);
                            string targetFile = File.Exists(candidate) ? candidate : Application.ExecutablePath;
                            byte[] exeBytes = File.ReadAllBytes(targetFile);
                            WriteDownloadResponse(stream, fileName, exeBytes);
                            AppendLog("Served standalone Windows executable download: " + fileName);
                            return;
                        }

                        // Serve static embedded asset
                        byte[] assetData;
                        if (_assets.TryGetValue(path, out assetData))
                        {
                            WriteResponse(stream, "200 OK", _mimeTypes[path], assetData);
                            return;
                        }

                        // SPA Fallback to /index.html
                        if (_assets.TryGetValue("/index.html", out assetData))
                        {
                            WriteResponse(stream, "200 OK", "text/html; charset=utf-8", assetData);
                            return;
                        }

                        WriteResponse(stream, "404 Not Found", "text/plain", Encoding.UTF8.GetBytes("Not Found"));
                    }
                }
                catch { }
            }
        }

        private static void WriteResponse(NetworkStream stream, string status, string contentType, byte[] body)
        {
            string headers = string.Format(
                "HTTP/1.1 {0}\r\nContent-Type: {1}\r\nContent-Length: {2}\r\nCache-Control: no-cache\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
                status, contentType, body.Length
            );
            byte[] headerBytes = Encoding.ASCII.GetBytes(headers);
            stream.Write(headerBytes, 0, headerBytes.Length);
            stream.Write(body, 0, body.Length);
            stream.Flush();
        }

        private static void WriteDownloadResponse(NetworkStream stream, string fileName, byte[] body)
        {
            string headers = string.Format(
                "HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename=\"{0}\"\r\nContent-Length: {1}\r\nConnection: close\r\n\r\n",
                fileName, body.Length
            );
            byte[] headerBytes = Encoding.ASCII.GetBytes(headers);
            stream.Write(headerBytes, 0, headerBytes.Length);
            stream.Write(body, 0, body.Length);
            stream.Flush();
        }

        private void AppendLog(string message)
        {
            if (this.IsDisposed) return;
            string line = string.Format("[{0}] {1}\r\n", DateTime.Now.ToString("HH:mm:ss"), message);
            if (this.InvokeRequired)
            {
                try { this.BeginInvoke((Action)(() => _logBox.AppendText(line))); } catch { }
            }
            else
            {
                _logBox.AppendText(line);
            }
        }

        [STAThread]
        public static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            bool minimized = args != null && args.Length > 0 && args[0] == "--minimized";
            Application.Run(new MainForm(minimized));
        }
    }
}
