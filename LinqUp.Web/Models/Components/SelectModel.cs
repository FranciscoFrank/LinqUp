namespace LinqUp.Web.Models.Components
{
    public class SelectOption
    {
        public string Value { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
    }

    public class SelectFieldModel
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string? Placeholder { get; set; }
        public List<SelectOption> Options { get; set; } = new();
        public string? SelectedValue { get; set; }
        public bool Required { get; set; }
        public string? HelpText { get; set; }

        public string? LabelKey { get; set; }
        public string? PlaceholderKey { get; set; }
        public string? HelpTextKey { get; set; }
    }
}
