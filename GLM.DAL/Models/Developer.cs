namespace Game_Library_Management_DAL.Models
{
    public class Developer
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;

        public List<GameDeveloper> GameDevelopers { get; set; } = new();
    }
}
