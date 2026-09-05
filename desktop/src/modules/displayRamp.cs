using System;
using System.Runtime.InteropServices;
using System.Text;

// Helper nativo: aplica brilho/contraste/saturação no monitor (DDC/CI + gamma ramp).
// Uso: displayRamp.exe <saturation> <contrast> <brightness>   (0–200, 100 = padrão)

internal static class Native
{
    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    public static extern bool SetDeviceGammaRamp(IntPtr hDC, ushort[] ramp);

    [DllImport("user32.dll")]
    public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprcClip, MonitorEnumProc lpfnEnum, IntPtr dwData);

    public delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdcMonitor, IntPtr lprcMonitor, IntPtr dwData);

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
}

internal static class Program
{
    static int Main(string[] args)
    {
        double sat = 100, con = 100, bri = 100;
        if (args.Length > 0) double.TryParse(args[0], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out sat);
        if (args.Length > 1) double.TryParse(args[1], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out con);
        if (args.Length > 2) double.TryParse(args[2], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out bri);
        sat = Clamp(sat, 0, 200);
        con = Clamp(con, 0, 200);
        bri = Clamp(bri, 0, 200);

        bool ddc = ApplyDdc(bri, con, sat);
        bool gamma = ApplyGamma(sat, con, bri);

        Console.WriteLine("{\"ddc\":" + (ddc ? "true" : "false") + ",\"gamma\":" + (gamma ? "true" : "false") + "}");
        return (ddc || gamma) ? 0 : 1;
    }

    static double Clamp(double v, double a, double b)
    {
        if (v < a) return a;
        if (v > b) return b;
        return v;
    }

    static bool ApplyGamma(double satPct, double conPct, double briPct)
    {
        double sat = satPct / 100.0;
        double con = conPct / 100.0;
        double bri = briPct / 100.0;
        ushort[] ramp = new ushort[768];
        for (int ch = 0; ch < 3; ch++)
        {
            for (int v = 0; v < 256; v++)
            {
                double t = 128.0 + (v - 128.0) * sat;
                t = 128.0 + (t - 128.0) * con;
                t = t * bri;
                if (t < 0) t = 0;
                if (t > 255) t = 255;
                ramp[ch * 256 + v] = (ushort)(Math.Round(t) * 257.0);
            }
        }
        IntPtr dc = Native.GetDC(IntPtr.Zero);
        if (dc == IntPtr.Zero) return false;
        try
        {
            return Native.SetDeviceGammaRamp(dc, ramp);
        }
        finally
        {
            Native.ReleaseDC(IntPtr.Zero, dc);
        }
    }

    static bool ApplyDdc(double briPct, double conPct, double satPct)
    {
        // UI 0–200 → VCP 0–100 (100 no painel = metade do alcance do monitor).
        uint bri = (uint)Math.Max(0, Math.Min(100, Math.Round(briPct / 2.0)));
        uint con = (uint)Math.Max(0, Math.Min(100, Math.Round(conPct / 2.0)));
        uint sat = (uint)Math.Max(0, Math.Min(100, Math.Round(satPct / 2.0)));

        bool any = false;
        Native.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (hMon, hdc, rect, data) =>
        {
            uint count = 0;
            if (!Native.GetNumberOfPhysicalMonitorsFromHMONITOR(hMon, ref count) || count == 0)
                return true;
            Native.PHYSICAL_MONITOR[] mons = new Native.PHYSICAL_MONITOR[count];
            if (!Native.GetPhysicalMonitorsFromHMONITOR(hMon, count, mons))
                return true;
            try
            {
                for (int i = 0; i < mons.Length; i++)
                {
                    IntPtr h = mons[i].hPhysicalMonitor;
                    if (Native.SetVCPFeature(h, 0x10, bri)) any = true;
                    Native.SetVCPFeature(h, 0x12, con);
                    Native.SetVCPFeature(h, 0x8A, sat);
                }
            }
            finally
            {
                Native.DestroyPhysicalMonitors(count, mons);
            }
            return true;
        }, IntPtr.Zero);
        return any;
    }
}
