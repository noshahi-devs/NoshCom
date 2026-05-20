using Abp.Extensions;
using Abp.Reflection.Extensions;
using Microsoft.Extensions.Configuration;
using System.Collections.Concurrent;

namespace Elicom.Configuration;

public static class AppConfigurations
{
    private static readonly ConcurrentDictionary<string, IConfigurationRoot> _configurationCache;

    static AppConfigurations()
    {
        _configurationCache = new ConcurrentDictionary<string, IConfigurationRoot>();
    }

    public static IConfigurationRoot Get(string path, string environmentName = null, bool addUserSecrets = false)
    {
        var cacheKey = path + "#" + environmentName + "#" + addUserSecrets;
        return _configurationCache.GetOrAdd(
            cacheKey,
            _ => BuildConfiguration(path, environmentName, addUserSecrets)
        );
    }

    private static IConfigurationRoot BuildConfiguration(string path, string environmentName = null, bool addUserSecrets = false)
    {
        // Note: provider order matters. Add environment variables first so appsettings.json (and
        // appsettings.{Environment}.json) take precedence over any env vars set on the machine/session.
        // This prevents stale env vars (e.g., old DB passwords) from overriding updated JSON settings.
        var builder = new ConfigurationBuilder()
            .SetBasePath(path)
            .AddEnvironmentVariables()
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true);

        if (!environmentName.IsNullOrWhiteSpace())
        {
            builder = builder.AddJsonFile($"appsettings.{environmentName}.json", optional: true, reloadOnChange: true);
            builder = builder.AddJsonFile($"appsettings.{environmentName}.Local.json", optional: true, reloadOnChange: true);
        }

        if (addUserSecrets)
        {
            builder.AddUserSecrets(typeof(AppConfigurations).GetAssembly(), optional: true);
        }

        return builder.Build();
    }
}
