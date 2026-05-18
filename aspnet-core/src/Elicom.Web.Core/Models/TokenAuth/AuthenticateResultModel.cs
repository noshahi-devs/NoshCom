namespace Elicom.Models.TokenAuth
{
    public class AuthenticateResultModel
    {
        public string AccessToken { get; set; }

        public string EncryptedAccessToken { get; set; }

        public int ExpireInSeconds { get; set; }

        public long UserId { get; set; }

        public bool MfaRequired { get; set; }

        public string MfaChallengeId { get; set; }

        public int? MfaExpireInSeconds { get; set; }

        public string MfaDestinationMasked { get; set; }

        public string MfaMessage { get; set; }

        public string Message { get; set; }
    }
}
