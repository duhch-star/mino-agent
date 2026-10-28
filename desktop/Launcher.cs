// MINOS desktop bootstrap. Compile with the .NET Framework 4 csc.exe; no NuGet dependencies.
// The executable belongs at the installation root, beside backend/, pi-web/ and runtime/.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Launcher
{
    [STAThread]
    private static int Main(string[] args)
    {
        bool smoke = false;
        string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MINOS");
        try
        {
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--smoke-test") smoke = true;
                else if (args[i] == "--data-dir" && i + 1 < args.Length) data = args[++i];
                else if (args[i].StartsWith("--data-dir=", StringComparison.Ordinal)) data = args[i].Substring(11);
                else throw new ArgumentException("Unknown or incomplete argument: " + args[i]);
            }
            data = Path.GetFullPath(data);
            string mutexName;
            using (SHA256 hash = SHA256.Create())
                mutexName = "Local\\MINOS.Desktop." + BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(data.TrimEnd('\\').ToUpperInvariant()))).Replace("-", "");
            bool created;
            using (Mutex mutex = new Mutex(true, mutexName, out created))
            {
                if (!created)
                {
                    if (!smoke) MessageBox.Show("MINOS 已在运行，请使用系统托盘菜单打开。", "MINOS");
                    return 2;
                }
                ServiceHost host = null;
                try
                {
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    host = new ServiceHost(FindRoot(), data, smoke);
                    using (StatusWindow window = new StatusWindow(host)) Application.Run(window);
                    return host.ExitCode;
                }
                finally
                {
                    if (host != null) host.Dispose(); // Exact owned process trees only, including smoke/error paths.
                    mutex.ReleaseMutex();
                }
            }
        }
        catch (Exception ex)
        {
            if (!smoke) MessageBox.Show(ex.Message, "MINOS 启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
            else { try { Directory.CreateDirectory(data); File.WriteAllText(Path.Combine(data, "smoke-test.json"), "{\"ok\":false,\"error\":" + ServiceHost.Json(ex.Message) + "}", new UTF8Encoding(false)); } catch { } }
            return 1;
        }
    }

    private static string FindRoot()
    {
        DirectoryInfo directory = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);
        for (int i = 0; directory != null && i < 3; i++, directory = directory.Parent)
            if (Directory.Exists(Path.Combine(directory.FullName, "backend", "app")) && Directory.Exists(Path.Combine(directory.FullName, "pi-web"))) return directory.FullName;
        throw new DirectoryNotFoundException("安装目录缺少 backend/app 或 pi-web；请保持完整安装目录布局。");
    }
}

internal sealed class ServiceHost : IDisposable
{
    internal readonly string Root, Data, Logs;
    internal readonly bool Smoke;
    internal string FrontendUrl = "", BackendUrl = "";
    internal volatile bool Ready, Finished;
    internal int ExitCode = 1;
    internal event Action<string> Status;
    private readonly object gate = new object(), logGate = new object();
    private readonly List<Process> owned = new List<Process>();
    private readonly AutoResetEvent wake = new AutoResetEvent(false);
    private volatile bool stopping, restarting;
    private Thread worker;
    private IntPtr job;
    private StreamWriter launcherLog;
    private int disposed;

    internal ServiceHost(string root, string data, bool smoke)
    {
        Root = root; Data = data; Smoke = smoke; Logs = Path.Combine(Data, "logs");
        Directory.CreateDirectory(Data); Directory.CreateDirectory(Logs);
        Directory.CreateDirectory(Path.Combine(Data, "gateway"));
        Directory.CreateDirectory(Path.Combine(Data, "browser-profile"));
        Directory.CreateDirectory(Path.Combine(Data, "temp"));
        launcherLog = new StreamWriter(Path.Combine(Logs, "launcher.log"), true, new UTF8Encoding(false));
        launcherLog.AutoFlush = true;
        CreateConfiguration();
        // A kill-on-close job supplements taskkill when Windows terminates the launcher abruptly.
        job = Native.CreateJobObject(IntPtr.Zero, null);
        if (job != IntPtr.Zero)
        {
            Native.JobExtended info = new Native.JobExtended();
            info.Basic.LimitFlags = 0x2000;
            if (!Native.SetInformationJobObject(job, 9, ref info, (uint)Marshal.SizeOf(typeof(Native.JobExtended))))
            { Native.CloseHandle(job); job = IntPtr.Zero; }
        }
    }

    private void CreateConfiguration()
    {
        string path = Path.Combine(Data, ".env");
        if (File.Exists(path)) return; // Never copy a checkout/user .env or replace an edited configuration.
        byte[] random = new byte[48];
        using (RandomNumberGenerator rng = RandomNumberGenerator.Create()) rng.GetBytes(random);
        string secret = BitConverter.ToString(random).Replace("-", "").ToLowerInvariant();
        string text = "# MINOS local configuration. Save and choose Restart services.\r\n"
            + "# JWT signing secret: backend Settings uses SECRET_KEY (not JWT_SECRET).\r\n"
            + "SECRET_KEY=" + secret + "\r\nSEED_DEMO_DATA=false\r\nDEBUG=false\r\n"
            + "# Supply your own OpenAI-compatible provider; no demo credentials are shipped.\r\n"
            + "LLM_API_KEY=\r\nLLM_BASE_URL=\r\nLLM_MODEL=\r\nINTERVIEW_LLM_MODEL=\r\n"
            + "MINERU_API_KEY=\r\nMAMBO_TTS_KEY=\r\n";
        try
        {
            using (FileStream file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            { byte[] bytes = new UTF8Encoding(false).GetBytes(text); file.Write(bytes, 0, bytes.Length); }
        }
        catch (IOException) { if (!File.Exists(path)) throw; }
    }

    internal void Start()
    {
        worker = new Thread(Run); worker.IsBackground = true; worker.Name = "MINOS service supervisor"; worker.Start();
    }
    internal void Restart() { if (!stopping) { restarting = true; wake.Set(); } }
    internal void Stop() { stopping = true; wake.Set(); }
    private void Say(string message)
    {
        Log("launcher", message);
        Action<string> handler = Status; if (handler != null) handler(message);
    }
    private void Log(string service, string message)
    {
        lock (logGate)
        {
            if (launcherLog == null) return;
            try { launcherLog.WriteLine(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " [" + service + "] " + message); } catch { }
        }
    }

    private void Run()
    {
        while (!stopping)
        {
            RunCycle();
            if (Smoke || !restarting) break;
        }
        Finished = true;
    }

    private void RunCycle()
    {
        try
        {
            do
            {
                restarting = false; Ready = false;
                StopServices();
                if (stopping) break;
                bool started = false;
                Exception last = null;
                for (int attempt = 0; attempt < 3 && !stopping && !restarting; attempt++)
                {
                    try { StartServices(attempt); started = true; break; }
                    catch (Exception ex) { last = ex; StopServices(); Log("launcher", "Startup attempt failed: " + ex.Message); }
                }
                if (stopping || restarting) continue;
                if (!started) throw last ?? new Exception("服务启动失败。");
                Ready = true; ExitCode = 0;
                Say("MINOS 已就绪\r\n" + FrontendUrl + "\r\n后端：" + BackendUrl + "\r\n关闭本窗口将保留托盘；退出请使用托盘菜单。");
                if (Smoke) { WriteSmoke(true, null); break; }
                // The browser is deliberately external Chromium, never WebView (WebSpeech support).
                try { OpenBrowser(); } catch (Exception ex) { Say("服务已就绪。浏览器打开失败：" + ex.Message + "\r\n" + FrontendUrl); }
                while (!stopping && !restarting)
                {
                    wake.WaitOne(1000);
                    if (!stopping && !restarting && AnyExited()) throw new Exception("服务意外退出，请查看日志并重启服务。");
                }
            } while (!stopping);
        }
        catch (Exception ex)
        {
            ExitCode = 1; Ready = false; StopServices();
            Say("启动失败：" + ex.Message + "\r\n日志目录：" + Logs);
            if (Smoke) WriteSmoke(false, ex.Message);
            // Keep the status/tray available for configuration and retry after a failed startup.
            if (!Smoke && !stopping)
            {
                while (!stopping && !restarting) wake.WaitOne();
            }
        }
        finally { Ready = false; StopServices(); }
    }

    private void StartServices(int attempt)
    {
        string python = Path.Combine(Root, "runtime", "python", "python.exe");
        string node = Path.Combine(Root, "runtime", "node", "node.exe");
        string project = Path.Combine(Root, "pi-web");
        Require(python); Require(node); Require(Path.Combine(project, ".next", "BUILD_ID"));
        Require(Path.Combine(project, "node_modules", "next", "dist", "cli", "next-start.js"));
        int frontPort = FreePort(attempt == 0 ? 5175 : 0);
        int backPort = FreePort(attempt == 0 ? 8005 : 0);
        while (backPort == frontPort) backPort = FreePort(0);
        FrontendUrl = "http://127.0.0.1:" + frontPort;
        BackendUrl = "http://127.0.0.1:" + backPort;
        Say("正在启动后端：" + BackendUrl);
        StartProcess(python, "-u -m uvicorn app.main:app --host 127.0.0.1 --port " + backPort + " --no-access-log", Path.Combine(Root, "backend"), "backend");
        WaitHealthy(BackendUrl + "/health", true, 120);
        if (stopping || restarting) return;
        Say("正在启动 MINOS 界面：" + FrontendUrl);
        // Prevent Next from loading installation .env* files. Only backend reads Data/.env.
        // nextStart is the same production entry used by `next start`, without npm/shell wrappers.
        string script = "const envPath=require.resolve('@next/env');const env=require(envPath);"
            + "require.cache[envPath].exports=Object.assign({},env,{loadEnvConfig:()=>({combinedEnv:process.env,parsedEnv:{},loadedEnvFiles:[]})});"
            + "process.env.__NEXT_PROCESSED_ENV='true';"
            + "require('next/dist/cli/next-start').nextStart({hostname:'127.0.0.1',port:" + frontPort + "},process.cwd()).catch(()=>{console.error('MINOS Next startup failed');process.exit(1)});";
        string encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(script));
        StartProcess(node, "-e " + Quote("eval(Buffer.from('" + encoded + "','base64').toString('utf8'))"), project, "frontend");
        WaitHealthy(FrontendUrl + "/login", false, 120);
        // Confirm both processes and both HTTP endpoints after the frontend has initialized.
        WaitHealthy(BackendUrl + "/health", true, 15);
        if (AnyExited()) throw new Exception("服务在健康检查后退出。");
    }

    private static void Require(string path) { if (!File.Exists(path)) throw new FileNotFoundException("安装资源缺失：" + path); }
    private static int FreePort(int preferred)
    {
        if (preferred != 0)
        {
            TcpListener probe = new TcpListener(IPAddress.Loopback, preferred);
            try { probe.Server.ExclusiveAddressUse = true; probe.Start(); return preferred; }
            catch (SocketException) { }
            finally { probe.Stop(); }
        }
        TcpListener listener = new TcpListener(IPAddress.Loopback, 0);
        try { listener.Server.ExclusiveAddressUse = true; listener.Start(); return ((IPEndPoint)listener.LocalEndpoint).Port; }
        finally { listener.Stop(); }
    }

    private ProcessStartInfo ServiceInfo(string executable, string arguments, string working)
    {
        ProcessStartInfo info = new ProcessStartInfo(executable, arguments);
        info.WorkingDirectory = working; info.UseShellExecute = false; info.CreateNoWindow = true;
        info.RedirectStandardOutput = true; info.RedirectStandardError = true;
        // Explicit allowlist: do not inherit API keys, database credentials, proxy settings,
        // NODE_OPTIONS, PYTHONPATH, or user-supplied MINOS/PI configuration.
        info.EnvironmentVariables.Clear();
        string[] allowed = { "SystemRoot", "WINDIR", "SystemDrive", "COMSPEC", "PATHEXT", "OS", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "ProgramFiles", "ProgramFiles(x86)", "ProgramW6432", "LOCALAPPDATA", "APPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "USERNAME", "USERDOMAIN" };
        foreach (string name in allowed) { string value = Environment.GetEnvironmentVariable(name); if (!String.IsNullOrEmpty(value)) info.EnvironmentVariables[name] = value; }
        string windows = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        info.EnvironmentVariables["PATH"] = Path.Combine(Root, "runtime", "node") + ";" + Path.Combine(Root, "runtime", "python") + ";" + Path.Combine(windows, "System32") + ";" + windows;
        info.EnvironmentVariables["TEMP"] = Path.Combine(Data, "temp");
        info.EnvironmentVariables["TMP"] = Path.Combine(Data, "temp");
        info.EnvironmentVariables["MINOS_API_BASE_URL"] = BackendUrl;
        info.EnvironmentVariables["MINOS_GATEWAY"] = "1";
        info.EnvironmentVariables["MINOS_DESKTOP"] = "1";
        info.EnvironmentVariables["MINOS_DATA_DIR"] = Data;
        info.EnvironmentVariables["MINOS_APP_ROOT"] = Root;
        info.EnvironmentVariables["MINOS_GATEWAY_SESSION_DIR"] = Path.Combine(Data, "gateway");
        info.EnvironmentVariables["PI_CODING_AGENT_DIR"] = Path.Combine(Data, "gateway-agent");
        info.EnvironmentVariables["NODE_ENV"] = "production";
        info.EnvironmentVariables["NEXT_TELEMETRY_DISABLED"] = "1";
        info.EnvironmentVariables["PI_WEB_ALLOWED_HOSTS"] = "localhost,127.0.0.1,[::1]";
        info.EnvironmentVariables["PI_WEB_SKIP_VERSION_CHECK"] = "1";
        info.EnvironmentVariables["PI_SKIP_VERSION_CHECK"] = "1";
        info.EnvironmentVariables["DO_NOT_TRACK"] = "1";
        info.EnvironmentVariables["OTEL_SDK_DISABLED"] = "true";
        info.EnvironmentVariables["PYTHONUTF8"] = "1";
        info.EnvironmentVariables["PYTHONIOENCODING"] = "utf-8";
        info.EnvironmentVariables["PYTHONDONTWRITEBYTECODE"] = "1";
        info.EnvironmentVariables["SEED_DEMO_DATA"] = "false";
        return info;
    }

    private void StartProcess(string executable, string arguments, string working, string name)
    {
        Process process = new Process(); process.StartInfo = ServiceInfo(executable, arguments, working);
        process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) Log(name, e.Data); };
        process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) Log(name, e.Data); };
        lock (gate)
        {
            if (stopping) { process.Dispose(); throw new OperationCanceledException(); }
            if (!process.Start()) { process.Dispose(); throw new Exception("无法启动 " + name); }
            owned.Add(process); // Keep original Process handles, never enumerate/kill by name or port.
            if (job != IntPtr.Zero && !Native.AssignProcessToJobObject(job, process.Handle)) Log("launcher", "Job assignment unavailable; exact PID tree cleanup remains enabled.");
            process.BeginOutputReadLine(); process.BeginErrorReadLine();
        }
    }

    private bool AnyExited()
    {
        lock (gate) { foreach (Process process in owned) if (process.HasExited) return true; }
        return false;
    }
    private void WaitHealthy(string url, bool backend, int seconds)
    {
        Stopwatch clock = Stopwatch.StartNew();
        while (clock.Elapsed.TotalSeconds < seconds)
        {
            if (stopping || restarting) return;
            if (AnyExited()) throw new Exception("服务已退出，请查看 launcher.log。");
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                request.Proxy = null; request.Timeout = 1500; request.ReadWriteTimeout = 1500; request.AllowAutoRedirect = false;
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    if (response.StatusCode == HttpStatusCode.OK)
                    {
                        if (!backend) return;
                        using (StreamReader reader = new StreamReader(response.GetResponseStream()))
                        { string body = reader.ReadToEnd(); if (body.IndexOf("xiaomin-backend", StringComparison.Ordinal) >= 0 && body.IndexOf("ok", StringComparison.Ordinal) >= 0) return; }
                    }
                }
            }
            catch (WebException) { }
            wake.WaitOne(250);
        }
        throw new TimeoutException("服务健康检查超时：" + url);
    }

    private void StopServices()
    {
        lock (gate)
        {
            for (int i = owned.Count - 1; i >= 0; i--)
            {
                Process process = owned[i];
                try
                {
                    // A live original Process handle prevents matching a stale/reused PID.
                    if (!process.HasExited)
                    {
                        ProcessStartInfo kill = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "taskkill.exe"), "/PID " + process.Id + " /T /F");
                        kill.UseShellExecute = false; kill.CreateNoWindow = true;
                        using (Process killer = Process.Start(kill)) { if (killer != null && !killer.WaitForExit(10000)) Log("launcher", "taskkill timed out for owned service."); }
                        if (!process.WaitForExit(5000)) process.Kill();
                    }
                }
                catch (Exception ex) { Log("launcher", "Owned service cleanup: " + ex.Message); }
                finally { process.Dispose(); }
            }
            owned.Clear();
            // Roots may already have exited, leaving grandchildren (e.g. account sidecars).
            // The private job owns only this launcher's service descendants, never development servers.
            if (job != IntPtr.Zero) Native.TerminateJobObject(job, 1);
        }
    }

    internal void OpenBrowser()
    {
        if (!Ready || String.IsNullOrEmpty(FrontendUrl)) return;
        string browser = FindBrowser();
        if (browser == null) { Process.Start(new ProcessStartInfo(FrontendUrl) { UseShellExecute = true }); return; }
        ProcessStartInfo info = new ProcessStartInfo(browser, "--app=" + FrontendUrl + " --user-data-dir=" + Quote(Path.Combine(Data, "browser-profile")) + " --no-first-run --no-default-browser-check");
        info.UseShellExecute = false;
        using (Process process = Process.Start(info)) { } // Browser is intentionally not part of the owned service job.
    }
    private static string FindBrowser()
    {
        foreach (string executable in new string[] { "msedge.exe", "chrome.exe" })
        {
            foreach (RegistryHive hive in new RegistryHive[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
                foreach (RegistryView view in new RegistryView[] { RegistryView.Registry64, RegistryView.Registry32 })
                    try
                    {
                        using (RegistryKey root = RegistryKey.OpenBaseKey(hive, view))
                        using (RegistryKey key = root.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\" + executable))
                        { string value = key == null ? null : key.GetValue(null) as string; if (!String.IsNullOrEmpty(value) && File.Exists(value.Trim('"'))) return value.Trim('"'); }
                    }
                    catch { }
            foreach (string folder in new string[] { Environment.GetEnvironmentVariable("ProgramFiles(x86)"), Environment.GetEnvironmentVariable("ProgramFiles"), Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) })
            {
                if (String.IsNullOrEmpty(folder)) continue;
                string candidate = Path.Combine(folder, executable == "msedge.exe" ? "Microsoft\\Edge\\Application\\msedge.exe" : "Google\\Chrome\\Application\\chrome.exe");
                if (File.Exists(candidate)) return candidate;
            }
        }
        return null;
    }
    internal static string Quote(string value)
    {
        // Windows CommandLineToArgvW-compatible quoting, including trailing backslashes.
        StringBuilder output = new StringBuilder("\""); int slashes = 0;
        foreach (char c in value)
        {
            if (c == '\\') { slashes++; continue; }
            if (c == '"') { output.Append('\\', slashes * 2 + 1); output.Append('"'); }
            else { output.Append('\\', slashes); output.Append(c); }
            slashes = 0;
        }
        output.Append('\\', slashes * 2); output.Append('"'); return output.ToString();
    }
    internal static string Json(string value)
    {
        if (value == null) return "null";
        StringBuilder text = new StringBuilder("\"");
        foreach (char c in value)
        {
            if (c == '\\' || c == '"') text.Append('\\').Append(c);
            else if (c < 32) text.Append("\\u").Append(((int)c).ToString("x4"));
            else text.Append(c);
        }
        return text.Append('"').ToString();
    }
    private void WriteSmoke(bool ok, string error)
    {
        string result = "{\"ok\":" + (ok ? "true" : "false") + ",\"frontendUrl\":" + Json(FrontendUrl) + ",\"backendUrl\":" + Json(BackendUrl)
            + ",\"urls\":{\"frontend\":" + Json(FrontendUrl) + ",\"backend\":" + Json(BackendUrl) + "},\"backendHealthy\":" + (ok ? "true" : "false")
            + ",\"frontendHealthy\":" + (ok ? "true" : "false") + ",\"error\":" + Json(error) + ",\"checkedAt\":" + Json(DateTime.UtcNow.ToString("o")) + "}";
        File.WriteAllText(Path.Combine(Data, "smoke-test.json"), result, new UTF8Encoding(false));
    }
    public void Dispose()
    {
        if (Interlocked.Exchange(ref disposed, 1) != 0) return;
        Stop();
        if (worker != null && worker != Thread.CurrentThread) worker.Join();
        StopServices();
        if (job != IntPtr.Zero) { Native.CloseHandle(job); job = IntPtr.Zero; }
        lock (logGate) { if (launcherLog != null) { launcherLog.Dispose(); launcherLog = null; } }
        wake.Dispose();
    }
}

internal sealed class StatusWindow : Form
{
    private readonly ServiceHost host;
    private readonly Label status;
    private readonly NotifyIcon tray;
    private readonly System.Windows.Forms.Timer timer;
    private bool quitting;
    internal StatusWindow(ServiceHost services)
    {
        host = services; Text = "MINOS 启动器"; ClientSize = new Size(570, 240);
        StartPosition = FormStartPosition.CenterScreen; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false;
        Font = new Font("Microsoft YaHei UI", 9F);
        status = new Label { Text = "正在准备 MINOS…", Location = new Point(22, 22), Size = new Size(525, 130) };
        Controls.Add(status);
        FlowLayoutPanel buttons = new FlowLayoutPanel { Location = new Point(18, 170), Size = new Size(540, 52) };
        AddButton(buttons, "打开 MINOS", delegate { Open(); });
        AddButton(buttons, "配置", delegate { Configure(); });
        AddButton(buttons, "日志", delegate { Shell(host.Logs); });
        AddButton(buttons, "重启服务", delegate { host.Restart(); });
        AddButton(buttons, "退出", delegate { Quit(); });
        Controls.Add(buttons);
        ContextMenuStrip menu = new ContextMenuStrip();
        menu.Items.Add("打开 MINOS", null, delegate { Open(); });
        menu.Items.Add("显示启动状态", null, delegate { Show(); WindowState = FormWindowState.Normal; Activate(); });
        menu.Items.Add("配置 (.env)", null, delegate { Configure(); });
        menu.Items.Add("日志目录", null, delegate { Shell(host.Logs); });
        menu.Items.Add("数据目录", null, delegate { Shell(host.Data); });
        menu.Items.Add("重启服务", null, delegate { host.Restart(); });
        menu.Items.Add(new ToolStripSeparator()); menu.Items.Add("退出", null, delegate { Quit(); });
        tray = new NotifyIcon { Icon = SystemIcons.Application, Text = "MINOS", ContextMenuStrip = menu, Visible = !host.Smoke };
        tray.DoubleClick += delegate { Open(); };
        host.Status += OnStatus;
        timer = new System.Windows.Forms.Timer(); timer.Interval = 200;
        timer.Tick += delegate { if (host.Finished) { quitting = true; Close(); } };
        Shown += delegate { timer.Start(); host.Start(); };
        FormClosing += delegate(object sender, FormClosingEventArgs e)
        {
            if (quitting || host.Finished) return;
            if (e.CloseReason == CloseReason.WindowsShutDown || e.CloseReason == CloseReason.TaskManagerClosing) { host.Stop(); return; }
            e.Cancel = true; Hide();
        };
    }
    private static void AddButton(FlowLayoutPanel panel, string text, EventHandler click)
    { Button button = new Button { Text = text, AutoSize = true, Height = 32 }; button.Click += click; panel.Controls.Add(button); }
    private void OnStatus(string text)
    {
        if (IsDisposed || !IsHandleCreated) return;
        try { BeginInvoke((MethodInvoker)delegate { status.Text = text; }); } catch (InvalidOperationException) { }
    }
    private void Open() { try { host.OpenBrowser(); } catch (Exception ex) { MessageBox.Show(this, ex.Message, "MINOS"); } }
    private void Configure()
    {
        try { Process.Start(new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "notepad.exe"), ServiceHost.Quote(Path.Combine(host.Data, ".env"))) { UseShellExecute = false }); }
        catch (Exception ex) { MessageBox.Show(this, ex.Message, "MINOS"); }
    }
    private void Shell(string path) { try { Process.Start(new ProcessStartInfo(path) { UseShellExecute = true }); } catch (Exception ex) { MessageBox.Show(this, ex.Message, "MINOS"); } }
    private void Quit() { status.Text = "正在停止本次启动的服务…"; host.Stop(); }
    protected override void Dispose(bool disposing)
    {
        if (disposing) { host.Status -= OnStatus; timer.Dispose(); tray.Visible = false; tray.Dispose(); }
        base.Dispose(disposing);
    }
}

internal static class Native
{
    [StructLayout(LayoutKind.Sequential)] internal struct JobBasic
    {
        internal long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        internal uint LimitFlags;
        internal UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        internal uint ActiveProcessLimit;
        internal UIntPtr Affinity;
        internal uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] internal struct IoCounters
    { internal ulong ReadOperationCount, WriteOperationCount, OtherOperationCount, ReadTransferCount, WriteTransferCount, OtherTransferCount; }
    [StructLayout(LayoutKind.Sequential)] internal struct JobExtended
    {
        internal JobBasic Basic; internal IoCounters Io;
        internal UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] internal static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll")] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool SetInformationJobObject(IntPtr job, int informationClass, ref JobExtended information, uint length);
    [DllImport("kernel32.dll")] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool TerminateJobObject(IntPtr job, uint exitCode);
    [DllImport("kernel32.dll")] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool CloseHandle(IntPtr handle);
}
