using System;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;

// Helper nativo: aplica cor na tela real (gamma ramp por monitor + DDC/CI).
// Uso único:  displayRamp.exe <sat> <con> <bri> <gamma> <temp> <cx> <cy> [ddc]
// Persistente: displayRamp.exe --serve
//   stdin: apply <sat> <con> <bri> <gamma> <temp> <cx> <cy> [ddc]
//   valores 0–200 (100 = padrão). cx/cy = centro do monitor (-1 = todos).
//   ddc=0 pula DDC/CI (rápido, só gamma ramp); ddc=1 aplica no hardware.

internal static class Native
{
    public const int MONITORINFOF_PRIMARY = 1;

    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    public static extern bool SetDeviceGammaRamp(IntPtr hDC, ushort[] ramp);

    [DllImport("gdi32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr CreateDC(string lpszDriver, string lpszDevice, string lpszOutput, IntPtr lpInitData);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);

    public delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData);

    [DllImport("user32.dll")]
    public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprcClip, MonitorEnumProc lpfnEnum, IntPtr dwData);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFOEX lpmi);

    [DllImport("dxva2.dll")]
    public static extern bool GetNumberOfPhysicalMonitorsFromHMONITOR(IntPtr hMonitor, ref uint count);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct PHYSICAL_MONITOR
    {
        public IntPtr hPhysicalMonitor;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string szPhysicalMonitorDescription;
    }

    [DllImport("dxva2.dll", CharSet = CharSet.Auto)]
    public static extern bool GetPhysicalMonitorsFromHMONITOR(IntPtr hMonitor, uint count, [Out] PHYSICAL_MONITOR[] monitors);

    [DllImport("dxva2.dll")]
    public static extern bool SetVCPFeature(IntPtr hPhysicalMonitor, byte code, uint value);

    [DllImport("dxva2.dll")]
    public static extern bool DestroyPhysicalMonitors(uint count, PHYSICAL_MONITOR[] monitors);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int left, top, right, bottom;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct MONITORINFOEX
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string szDevice;
    }
}

internal sealed class MonitorTarget
{
    public IntPtr Handle;
    public string Device;
    public Native.RECT Bounds;
    public bool Primary;
}

internal static class Program
{
    static int Main(string[] args)
    {
        if (args.Length > 0 && string.Equals(args[0], "--serve", StringComparison.OrdinalIgnoreCase))
        {
            RunServe();
            return 0;
        }

        // ddc default 0: só gamma ramp, a menos que o app peça DDC explicitamente.
        double sat = 100, con = 100, bri = 100, gamma = 100, temp = 100, cx = -1, cy = -1, ddc = 0;
        ParseNums(args, 0, ref sat, ref con, ref bri, ref gamma, ref temp, ref cx, ref cy, ref ddc);
        WriteResult(Apply(sat, con, bri, gamma, temp, cx, cy, ddc >= 0.5));
        return 0;
    }

    static void RunServe()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            line = line.Trim();
            if (line.Length == 0) continue;
            if (string.Equals(line, "quit", StringComparison.OrdinalIgnoreCase)) break;

            string payload = line;
            if (payload.StartsWith("apply ", StringComparison.OrdinalIgnoreCase))
                payload = payload.Substring(6);

            string[] parts = payload.Split(new char[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
            double sat = 100, con = 100, bri = 100, gamma = 100, temp = 100, cx = -1, cy = -1, ddc = 0;
            ParseNums(parts, 0, ref sat, ref con, ref bri, ref gamma, ref temp, ref cx, ref cy, ref ddc);
            WriteResult(Apply(sat, con, bri, gamma, temp, cx, cy, ddc >= 0.5));
        }
    }

    static void ParseNums(string[] parts, int start, ref double sat, ref double con, ref double bri, ref double gamma, ref double temp, ref double cx, ref double cy, ref double ddc)
    {
        if (parts == null) return;
        if (parts.Length > start + 0) TryNum(parts[start + 0], ref sat);
        if (parts.Length > start + 1) TryNum(parts[start + 1], ref con);
        if (parts.Length > start + 2) TryNum(parts[start + 2], ref bri);
        if (parts.Length > start + 3) TryNum(parts[start + 3], ref gamma);
        if (parts.Length > start + 4) TryNum(parts[start + 4], ref temp);
        if (parts.Length > start + 5) TryNum(parts[start + 5], ref cx);
        if (parts.Length > start + 6) TryNum(parts[start + 6], ref cy);
        if (parts.Length > start + 7) TryNum(parts[start + 7], ref ddc);
    }

    static void TryNum(string s, ref double dest)
    {
        double v;
        if (double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out v))
            dest = v;
    }

    static void WriteResult(bool[] ok)
    {
        Console.WriteLine("{\"ddc\":" + (ok[0] ? "true" : "false") + ",\"gamma\":" + (ok[1] ? "true" : "false") + "}");
        Console.Out.Flush();
    }

    static bool[] Apply(double sat, double con, double bri, double gamma, double temp, double cx, double cy, bool doDdc)
    {
        sat = Clamp(sat, 0, 200);
        con = Clamp(con, 0, 200);
        bri = Clamp(bri, 0, 200);
        gamma = Clamp(gamma, 40, 250);
        temp = Clamp(temp, 0, 200);

        List<MonitorTarget> all = ListMonitors();
        List<MonitorTarget> targets = FilterTargets(all, cx, cy);

        // Gamma ramp primeiro (rápido, sempre funciona no Windows).
        bool gammaOk = ApplyGamma(targets, sat, con, bri, gamma, temp);
        bool ddcOk = false;
        if (doDdc)
            ddcOk = ApplyDdc(targets, bri, con, sat, temp);
        return new bool[] { ddcOk, gammaOk };
    }

    static List<MonitorTarget> ListMonitors()
    {
        List<MonitorTarget> list = new List<MonitorTarget>();
        Native.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, delegate(IntPtr hMon, IntPtr hdc, ref Native.RECT rect, IntPtr data)
        {
            Native.MONITORINFOEX info = new Native.MONITORINFOEX();
            info.cbSize = Marshal.SizeOf(typeof(Native.MONITORINFOEX));
            string device = null;
            bool primary = false;
            Native.RECT bounds = rect;
            if (Native.GetMonitorInfo(hMon, ref info))
            {
                device = info.szDevice;
                primary = (info.dwFlags & Native.MONITORINFOF_PRIMARY) != 0;
                bounds = info.rcMonitor;
            }
            MonitorTarget t = new MonitorTarget();
            t.Handle = hMon;
            t.Device = device;
            t.Bounds = bounds;
            t.Primary = primary;
            list.Add(t);
            return true;
        }, IntPtr.Zero);
        return list;
    }

    static List<MonitorTarget> FilterTargets(List<MonitorTarget> all, double cx, double cy)
    {
        if (all.Count == 0) return all;
        if (cx < 0 || cy < 0) return all;

        int x = (int)Math.Round(cx);
        int y = (int)Math.Round(cy);
        for (int i = 0; i < all.Count; i++)
        {
            Native.RECT r = all[i].Bounds;
            if (x >= r.left && x < r.right && y >= r.top && y < r.bottom)
            {
                List<MonitorTarget> one = new List<MonitorTarget>(1);
                one.Add(all[i]);
                return one;
            }
        }
        return all;
    }

    static bool ApplyGamma(List<MonitorTarget> targets, double satPct, double conPct, double briPct, double gammaPct, double tempPct)
    {
        ushort[] ramp = BuildRamp(satPct, conPct, briPct, gammaPct, tempPct);
        bool any = false;

        if (targets != null)
        {
            for (int i = 0; i < targets.Count; i++)
            {
                string device = targets[i].Device;
                if (string.IsNullOrEmpty(device)) continue;
                IntPtr dc = Native.CreateDC("DISPLAY", device, null, IntPtr.Zero);
                if (dc == IntPtr.Zero) continue;
                try
                {
                    if (Native.SetDeviceGammaRamp(dc, ramp)) any = true;
                }
                finally
                {
                    Native.DeleteDC(dc);
                }
            }
        }

        if (!any)
        {
            IntPtr dc = Native.GetDC(IntPtr.Zero);
            if (dc != IntPtr.Zero)
            {
                try { any = Native.SetDeviceGammaRamp(dc, ramp); }
                finally { Native.ReleaseDC(IntPtr.Zero, dc); }
            }
        }
        return any;
    }

    static ushort[] BuildRamp(double satPct, double conPct, double briPct, double gammaPct, double tempPct)
    {
        double sat = satPct / 100.0;
        double con = conPct / 100.0;
        double bri = briPct / 100.0;
        double gamma = gammaPct / 100.0;
        if (gamma < 0.4) gamma = 0.4;
        if (gamma > 2.5) gamma = 2.5;

        double kelvin = 4000.0 + (tempPct / 100.0) * 2500.0;
        double tr, tg, tb;
        TempToRgb(kelvin, out tr, out tg, out tb);

        ushort[] ramp = new ushort[768];
        for (int ch = 0; ch < 3; ch++)
        {
            double tf = ch == 0 ? tr : (ch == 1 ? tg : tb);
            for (int v = 0; v < 256; v++)
            {
                double n = v / 255.0;
                n = Math.Pow(n, 1.0 / gamma);
                double t = n * 255.0;
                t = 128.0 + (t - 128.0) * sat;
                t = 128.0 + (t - 128.0) * con;
                t = t * bri * tf;
                if (t < 0) t = 0;
                if (t > 255) t = 255;
                ramp[ch * 256 + v] = (ushort)(Math.Round(t) * 257.0);
            }
        }
        return ramp;
    }

    static void TempToRgb(double kelvin, out double r, out double g, out double b)
    {
        double t = (kelvin - 6500.0) / 2500.0;
        if (t < -1) t = -1;
        if (t > 1) t = 1;
        if (t <= 0)
        {
            r = 1.0;
            g = 1.0 + t * 0.08;
            b = 1.0 + t * 0.38;
        }
        else
        {
            r = 1.0 - t * 0.16;
            g = 1.0 - t * 0.04;
            b = 1.0;
        }
    }

    // Mapeia temperatura (0–200 → ~4000–6500K) para preset DDC VCP 0x0C.
    static uint TempToDdcPreset(double tempPct)
    {
        double kelvin = 4000.0 + (tempPct / 100.0) * 2500.0;
        if (kelvin < 4500) return 1; // 4000K
        if (kelvin < 5750) return 2; // 5000K
        if (kelvin < 7000) return 3; // 6500K
        if (kelvin < 7850) return 4; // 7500K
        if (kelvin < 8750) return 5; // 8200K
        if (kelvin < 9650) return 6; // 9300K
        return 7; // 10000K+
    }

    // UI usa 0–200 (%); VCP 0x10/0x12 esperam tipicamente 0–100.
    // NÃO dividir por 2 (bug antigo: 100% → brilho 50 no OSD do monitor).
    // NÃO escrever VCP 0x62 (em muitos monitores é VOLUME do alto-falante).
    // NÃO escrever VCP 0x0C (preset de temperatura) — altera o OSD de forma
    // permanente e imprevisível entre fabricantes.
    // satPct/tempPct só afetam a gamma ramp (mantidos na assinatura por compatibilidade).
    static bool ApplyDdc(List<MonitorTarget> targets, double briPct, double conPct, double satPct, double tempPct)
    {
        uint bri = (uint)Math.Max(0, Math.Min(100, Math.Round(briPct > 100 ? 100 : briPct)));
        uint con = (uint)Math.Max(0, Math.Min(100, Math.Round(conPct > 100 ? 100 : conPct)));

        bool any = false;
        if (targets == null) return false;
        for (int i = 0; i < targets.Count; i++)
        {
            uint count = 0;
            if (!Native.GetNumberOfPhysicalMonitorsFromHMONITOR(targets[i].Handle, ref count) || count == 0)
                continue;
            Native.PHYSICAL_MONITOR[] mons = new Native.PHYSICAL_MONITOR[count];
            if (!Native.GetPhysicalMonitorsFromHMONITOR(targets[i].Handle, count, mons))
                continue;
            try
            {
                for (int j = 0; j < mons.Length; j++)
                {
                    IntPtr h = mons[j].hPhysicalMonitor;
                    if (Native.SetVCPFeature(h, 0x10, bri)) any = true; // brilho
                    if (Native.SetVCPFeature(h, 0x12, con)) any = true; // contraste
                }
            }
            finally
            {
                Native.DestroyPhysicalMonitors(count, mons);
            }
        }
        return any;
    }

    static double Clamp(double v, double a, double b)
    {
        if (v < a) return a;
        if (v > b) return b;
        return v;
    }
}
