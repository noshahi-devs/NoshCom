using Elicom.Configuration.Dto;
using System.Threading.Tasks;

namespace Elicom.Configuration;

public interface IConfigurationAppService
{
    Task ChangeUiTheme(ChangeUiThemeInput input);
}
