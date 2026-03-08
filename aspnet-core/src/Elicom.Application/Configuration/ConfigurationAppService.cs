using Abp.Authorization;
using Abp.Runtime.Session;
using Elicom.Configuration.Dto;
using System.Threading.Tasks;

namespace Elicom.Configuration;

[AbpAuthorize]
public class ConfigurationAppService : ElicomAppServiceBase, IConfigurationAppService
{
    public async Task ChangeUiTheme(ChangeUiThemeInput input)
    {
        await SettingManager.ChangeSettingForUserAsync(AbpSession.ToUserIdentifier(), AppSettingNames.UiTheme, input.Theme);
    }
}
