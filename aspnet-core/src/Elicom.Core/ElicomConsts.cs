using Elicom.Debugging;

namespace Elicom;

public class ElicomConsts
{
    public const string LocalizationSourceName = "Elicom";

        public const string ConnectionStringName = "DefaultConnection";


    public const bool MultiTenancyEnabled = true;


    /// <summary>
    /// Default pass phrase for SimpleStringCipher decrypt/encrypt operations
    /// </summary>
    public static readonly string DefaultPassPhrase =
        DebugHelper.IsDebug ? "gsKxGZ012HLL3MI5" : "fc99c6b217ad4fbe8490effe3ccc7533";
}
