namespace Elicom.BackgroundJobs
{
    public class PlatformEmailJobArgs
    {
        public string PlatformName { get; set; }
        public string To { get; set; }
        public string Subject { get; set; }
        public string HtmlBody { get; set; }
    }
}
