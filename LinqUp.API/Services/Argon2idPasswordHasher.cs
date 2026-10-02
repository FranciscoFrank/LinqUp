using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;
using LinqUp.API.Identity;
using Microsoft.AspNetCore.Identity;

namespace LinqUp.API.Services
{
    // Replaces Identity's default PBKDF2 hasher. The stored string is self-describing
    // (PHC-like: $argon2id$v=19$m=..,t=..,p=..$salt$hash) so the cost parameters can be
    // raised later for new hashes without breaking verification of existing ones —
    // VerifyHashedPassword flags a rehash whenever a hash was made with older parameters.
    public class Argon2idPasswordHasher : IPasswordHasher<ApplicationUser>
    {
        private const int SaltSize = 16;
        private const int HashSize = 32;

        // Deliberately light for a dev project — legitimate Argon2id, just fast to iterate with.
        private const int MemoryKib = 9216;
        private const int Iterations = 4;
        private const int Parallelism = 1;

        public string HashPassword(ApplicationUser user, string password)
        {
            var salt = RandomNumberGenerator.GetBytes(SaltSize);
            var hash = ComputeHash(password, salt, MemoryKib, Iterations, Parallelism);

            return $"$argon2id$v=19$m={MemoryKib},t={Iterations},p={Parallelism}$" +
                   $"{Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
        }

        public PasswordVerificationResult VerifyHashedPassword(ApplicationUser user, string hashedPassword, string providedPassword)
        {
            if (!TryParse(hashedPassword, out var memoryKib, out var iterations, out var parallelism, out var salt, out var expectedHash))
            {
                return PasswordVerificationResult.Failed;
            }

            var actualHash = ComputeHash(providedPassword, salt, memoryKib, iterations, parallelism);

            if (!CryptographicOperations.FixedTimeEquals(actualHash, expectedHash))
            {
                return PasswordVerificationResult.Failed;
            }

            var isOutdated = memoryKib != MemoryKib || iterations != Iterations || parallelism != Parallelism;
            return isOutdated ? PasswordVerificationResult.SuccessRehashNeeded : PasswordVerificationResult.Success;
        }

        private static byte[] ComputeHash(string password, byte[] salt, int memoryKib, int iterations, int parallelism)
        {
            using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
            {
                Salt = salt,
                MemorySize = memoryKib,
                Iterations = iterations,
                DegreeOfParallelism = parallelism
            };

            return argon2.GetBytes(HashSize);
        }

        private static bool TryParse(string encoded, out int memoryKib, out int iterations, out int parallelism, out byte[] salt, out byte[] hash)
        {
            memoryKib = iterations = parallelism = 0;
            salt = hash = Array.Empty<byte>();

            // $argon2id$v=19$m=9216,t=4,p=1$<salt>$<hash>
            var parts = encoded.Split('$', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 5 || parts[0] != "argon2id")
            {
                return false;
            }

            var paramsPart = parts[2];
            foreach (var kv in paramsPart.Split(','))
            {
                var pair = kv.Split('=');
                if (pair.Length != 2 || !int.TryParse(pair[1], out var value))
                {
                    return false;
                }

                switch (pair[0])
                {
                    case "m": memoryKib = value; break;
                    case "t": iterations = value; break;
                    case "p": parallelism = value; break;
                }
            }

            try
            {
                salt = Convert.FromBase64String(parts[3]);
                hash = Convert.FromBase64String(parts[4]);
            }
            catch (FormatException)
            {
                return false;
            }

            return memoryKib > 0 && iterations > 0 && parallelism > 0 && salt.Length > 0 && hash.Length > 0;
        }
    }
}
