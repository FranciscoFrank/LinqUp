namespace LinqUp.Web.Models.Components
{
    public class ButtonModel
    {
        public string Id { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public string Type { get; set; } = "button";
        public string Variant { get; set; } = "primary";
        public bool FullWidth { get; set; }
        public string? TextKey { get; set; }
    }
}
