using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("Office Attendance Tracker - Windows Setup Wizard")]
[assembly: AssemblyDescription("Standalone Installer for Office Attendance Tracker Local Server")]
[assembly: AssemblyCompany("Apex Technologies Ltd.")]
[assembly: AssemblyProduct("Office Attendance Tracker Setup")]
[assembly: AssemblyVersion("2.4.0.0")]
[assembly: AssemblyFileVersion("2.4.0.0")]

namespace OfficeAttendanceSetup
{
    public class SetupForm : Form
    {
        private TextBox _pathBox;
        private CheckBox _desktopShortcutCheck;
        private CheckBox _startMenuCheck;
        private CheckBox _autoStartCheck;
        private CheckBox _firewallCheck;
        private CheckBox _launchNowCheck;
        private ProgressBar _progressBar;
        private Label _statusText;
        private Button _installBtn;

        public SetupForm()
        {
            string defaultDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs",
                "OfficeAttendanceTracker"
            );

            this.Text = "Office Attendance Tracker v2.4 — Windows Setup";
            this.Size = new Size(580, 470);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(15, 23, 42);
            this.ForeColor = Color.White;
            this.Font = new Font("Segoe UI", 9.5f);
            this.Icon = SystemIcons.Shield;

            // Header Banner
            Panel banner = new Panel
            {
                Dock = DockStyle.Top,
                Height = 82,
                BackColor = Color.FromArgb(30, 58, 138)
            };

            Label title = new Label
            {
                Text = "Install Office Attendance Tracker",
                Font = new Font("Segoe UI Semibold", 14f, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(22, 16),
                AutoSize = true
            };

            Label subtitle = new Label
            {
                Text = "Standalone Local Office Server & Desktop Application (Zero External Dependencies)",
                Font = new Font("Segoe UI", 9f),
                ForeColor = Color.FromArgb(191, 219, 254),
                Location = new Point(24, 46),
                AutoSize = true
            };

            banner.Controls.Add(title);
            banner.Controls.Add(subtitle);
            this.Controls.Add(banner);

            int y = 102;

            Label dirLabel = new Label
            {
                Text = "Installation Folder:",
                ForeColor = Color.FromArgb(203, 213, 225),
                Location = new Point(24, y),
                AutoSize = true
            };
            this.Controls.Add(dirLabel);

            _pathBox = new TextBox
            {
                Text = defaultDir,
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Location = new Point(24, y + 24),
                Size = new Size(420, 28)
            };
            this.Controls.Add(_pathBox);

            Button browseBtn = new Button
            {
                Text = "Browse...",
                BackColor = Color.FromArgb(51, 65, 85),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Location = new Point(454, y + 22),
                Size = new Size(86, 28),
                Cursor = Cursors.Hand
            };
            browseBtn.Click += (s, e) =>
            {
                using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                {
                    fbd.SelectedPath = _pathBox.Text;
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        _pathBox.Text = Path.Combine(fbd.SelectedPath, "OfficeAttendanceTracker");
                    }
                }
            };
            this.Controls.Add(browseBtn);

            y += 66;

            _desktopShortcutCheck = CreateCheck("Create Desktop Shortcut (\"Office Attendance Tracker\")", new Point(24, y), true);
            y += 30;
            _startMenuCheck = CreateCheck("Create Windows Start Menu Shortcut", new Point(24, y), true);
            y += 30;
            _autoStartCheck = CreateCheck("Start Attendance Server automatically when Windows starts", new Point(24, y), true);
            y += 30;
            _firewallCheck = CreateCheck("Add Windows Firewall rule for Office LAN access (Port 3000)", new Point(24, y), false);
            y += 30;
            _launchNowCheck = CreateCheck("Launch Office Attendance Tracker immediately after setup", new Point(24, y), true);

            y += 42;

            _progressBar = new ProgressBar
            {
                Location = new Point(24, y),
                Size = new Size(516, 18),
                Minimum = 0,
                Maximum = 100,
                Value = 0
            };
            this.Controls.Add(_progressBar);

            _statusText = new Label
            {
                Text = "Ready to install.",
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(24, y + 24),
                AutoSize = true
            };
            this.Controls.Add(_statusText);

            _installBtn = new Button
            {
                Text = "Install Now",
                BackColor = Color.FromArgb(37, 99, 235),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI Semibold", 10f, FontStyle.Bold),
                Location = new Point(390, y + 48),
                Size = new Size(150, 38),
                Cursor = Cursors.Hand
            };
            _installBtn.FlatAppearance.BorderSize = 0;
            _installBtn.Click += (s, e) => RunInstall();
            this.Controls.Add(_installBtn);
        }

        private CheckBox CreateCheck(string text, Point pt, bool isChecked)
        {
            CheckBox cb = new CheckBox
            {
                Text = text,
                ForeColor = Color.FromArgb(226, 232, 240),
                Location = pt,
                AutoSize = true,
                Checked = isChecked
            };
            this.Controls.Add(cb);
            return cb;
        }

        private void RunInstall()
        {
            try
            {
                _installBtn.Enabled = false;
                string installDir = _pathBox.Text.Trim();
                _statusText.Text = "Creating installation directory...";
                _progressBar.Value = 20;
                Application.DoEvents();

                Directory.CreateDirectory(installDir);
                Directory.CreateDirectory(Path.Combine(installDir, "data"));

                string targetExe = Path.Combine(installDir, "OfficeAttendanceTracker.exe");
                _statusText.Text = "Extracting standalone application binary...";
                _progressBar.Value = 50;
                Application.DoEvents();

                Assembly asm = Assembly.GetExecutingAssembly();
                using (Stream s = asm.GetManifestResourceStream("PortableApp.exe"))
                {
                    if (s == null) throw new Exception("Embedded application payload not found.");
                    using (FileStream fs = new FileStream(targetExe, FileMode.Create, FileAccess.Write))
                    {
                        s.CopyTo(fs);
                    }
                }

                // Also copy portable exe alongside for in-app downloads
                File.Copy(targetExe, Path.Combine(installDir, "OfficeAttendanceTracker-Portable.exe"), true);
                try { File.Copy(Application.ExecutablePath, Path.Combine(installDir, "OfficeAttendanceTracker-Setup.exe"), true); } catch { }

                _progressBar.Value = 75;
                _statusText.Text = "Creating Windows shortcuts...";
                Application.DoEvents();

                if (_desktopShortcutCheck.Checked)
                {
                    string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                    CreateShortcut(Path.Combine(desktopDir, "Office Attendance Tracker.lnk"), targetExe, installDir);
                }

                if (_startMenuCheck.Checked)
                {
                    string startMenuDir = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                    CreateShortcut(Path.Combine(startMenuDir, "Office Attendance Tracker.lnk"), targetExe, installDir);
                }

                if (_autoStartCheck.Checked)
                {
                    using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
                    {
                        if (key != null)
                        {
                            key.SetValue("OfficeAttendanceTracker", "\"" + targetExe + "\" --minimized");
                        }
                    }
                }

                if (_firewallCheck.Checked)
                {
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo
                        {
                            FileName = "netsh",
                            Arguments = "advfirewall firewall add rule name=\"Office Attendance Tracker\" dir=in action=allow protocol=TCP localport=3000",
                            Verb = "runas",
                            UseShellExecute = true,
                            WindowStyle = ProcessWindowStyle.Hidden
                        };
                        Process p = Process.Start(psi);
                        if (p != null) p.WaitForExit(4000);
                    }
                    catch { }
                }

                _progressBar.Value = 100;
                _statusText.Text = "Installation completed successfully!";
                Application.DoEvents();

                MessageBox.Show(
                    "Office Attendance Tracker has been installed successfully!\n\nLocation: " + installDir,
                    "Setup Complete",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );

                if (_launchNowCheck.Checked)
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = targetExe,
                        WorkingDirectory = installDir,
                        UseShellExecute = true
                    });
                }

                Application.Exit();
            }
            catch (Exception ex)
            {
                _installBtn.Enabled = true;
                _statusText.Text = "Installation failed: " + ex.Message;
                MessageBox.Show("Error during installation:\n" + ex.Message, "Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static void CreateShortcut(string shortcutPath, string targetExe, string workingDir)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null) return;
                object shell = Activator.CreateInstance(shellType);
                object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
                Type scType = shortcut.GetType();
                scType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetExe });
                scType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workingDir });
                scType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { "Office Attendance Tracker Local Server" });
                scType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
            }
            catch { }
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }
}
