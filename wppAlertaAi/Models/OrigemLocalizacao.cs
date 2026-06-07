namespace AlertAi.Models;

public static class OrigemLocalizacao
{
    public const string WhatsAppGps = "whatsapp_gps";
    public const string GeocodeTexto = "geocode_texto";
    public const string Desconhecida = "desconhecida";
}

public static class MensagemTriagem
{
    public const string PlaceholderLocalizacaoWhatsapp =
        "[Localização WhatsApp] O cidadão enviou apenas localização GPS via WhatsApp.";
}
