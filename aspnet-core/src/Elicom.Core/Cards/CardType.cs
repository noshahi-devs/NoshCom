using System.Text.Json.Serialization;

namespace Elicom.Cards
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum CardType
    {
        Visa = 0,
        MasterCard = 1,
        Amex = 2
    }
}
