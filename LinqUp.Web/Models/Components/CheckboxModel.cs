namespace LinqUp.Web.Models.Components
{
    public class CheckboxModel
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public bool Checked { get; set; }
        public string? HelpText { get; set; }
        public string? LabelKey { get; set; }
    }
}
