namespace LinqUp.Web.Models.Components
{
    public class TextFieldModel
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string Type { get; set; } = "text";
        public string? Placeholder { get; set; }
        public string? Value { get; set; }
        public bool Required { get; set; }
        public string? HelpText { get; set; }
        public string? AutoComplete { get; set; }
        public int? MaxLength { get; set; }
        public string? Icon { get; set; }
        public bool PasswordToggle { get; set; }

        // Optional data-i18n keys — when set, client-side i18n re-translates the text on language switch.
        public string? LabelKey { get; set; }
        public string? PlaceholderKey { get; set; }
        public string? HelpTextKey { get; set; }
    }
}
