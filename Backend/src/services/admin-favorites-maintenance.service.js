function favoriteCount(user) {
  return Array.isArray(user?.favorites) ? user.favorites.filter((id) => String(id ?? "").trim()).length : 0;
}

export function describeAdminFavoriteAccounts(users = []) {
  return users.map((user) => ({
    id: String(user?._id ?? ""),
    email: String(user?.email ?? "").trim().toLowerCase(),
    role: String(user?.role ?? ""),
    favoritesCount: favoriteCount(user)
  }));
}

export function summarizeAdminFavorites(accounts) {
  const withFavorites = accounts.filter((account) => account.favoritesCount > 0);
  return {
    admins: accounts.length,
    adminsWithFavorites: withFavorites.length,
    totalFavoriteIds: accounts.reduce((sum, account) => sum + account.favoritesCount, 0),
    accounts
  };
}

export async function diagnoseAdminFavorites(collection) {
  const users = await collection.find({ role: "admin" }).project({ email: 1, role: 1, favorites: 1 }).toArray();
  return summarizeAdminFavorites(describeAdminFavoriteAccounts(users));
}

export async function cleanupAdminFavorites(collection) {
  const before = await diagnoseAdminFavorites(collection);
  const result = await collection.updateMany(
    { role: "admin" },
    {
      $set: {
        favorites: [],
        updatedAt: new Date().toISOString()
      }
    }
  );
  return {
    matchedAdmins: result.matchedCount ?? 0,
    modifiedAdmins: result.modifiedCount ?? 0,
    before
  };
}
