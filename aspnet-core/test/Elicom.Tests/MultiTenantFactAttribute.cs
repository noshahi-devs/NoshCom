using Xunit;

namespace Elicom.Tests;

public sealed class MultiTenantFactAttribute : FactAttribute
{
    public MultiTenantFactAttribute()
    {
        if (!ElicomConsts.IsMultiTenancyEnabled)
        {
            Skip = "MultiTenancy is disabled.";
        }
    }
}
