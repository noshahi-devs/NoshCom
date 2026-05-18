using Abp.Auditing;
using Abp.Authorization.Users;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Elicom.Models.TokenAuth
{
    public class AuthenticateModel : IValidatableObject
    {
        [StringLength(AbpUserBase.MaxEmailAddressLength)]
        public string UserNameOrEmailAddress { get; set; }

        [StringLength(AbpUserBase.MaxPlainPasswordLength)]
        [DisableAuditing]
        public string Password { get; set; }

        public bool RememberClient { get; set; }

        [StringLength(64)]
        public string MfaChallengeId { get; set; }

        [StringLength(12)]
        public string MfaCode { get; set; }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            var hasMfa = !string.IsNullOrWhiteSpace(MfaChallengeId) && !string.IsNullOrWhiteSpace(MfaCode);
            if (hasMfa)
            {
                yield break;
            }

            if (string.IsNullOrWhiteSpace(UserNameOrEmailAddress))
            {
                yield return new ValidationResult(
                    "The UserNameOrEmailAddress field is required.",
                    new[] { "userNameOrEmailAddress" });
            }

            if (string.IsNullOrWhiteSpace(Password))
            {
                yield return new ValidationResult(
                    "The Password field is required.",
                    new[] { "password" });
            }
        }
    }
}
