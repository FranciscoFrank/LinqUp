namespace LinqUp.Web.Models.Components
{
    public class RadioOption
    {
        public string Value { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
    }

    public class RadioGroupModel
    {
        public string Name { get; set; } = string.Empty;
        public string Legend { get; set; } = string.Empty;
        public List<RadioOption> Options { get; set; } = new();
        public string? SelectedValue { get; set; }
        public string? LegendKey { get; set; }
    }
}
