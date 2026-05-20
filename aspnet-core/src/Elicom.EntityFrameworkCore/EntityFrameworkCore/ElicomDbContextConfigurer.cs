using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System;
using System.Data.Common;

namespace Elicom.EntityFrameworkCore;

public static class ElicomDbContextConfigurer
{
    public static void Configure(DbContextOptionsBuilder<ElicomDbContext> builder, string connectionString)
    {
        builder.UseSqlServer(connectionString, options =>
        {
            options.CommandTimeout(30);
        })
        .ConfigureWarnings(w => w.Ignore(SqlServerEventId.SavepointsDisabledBecauseOfMARS));
    }

    public static void Configure(DbContextOptionsBuilder<ElicomDbContext> builder, DbConnection connection)
    {
        builder.UseSqlServer(connection, options =>
        {
            options.CommandTimeout(30);
        })
        .ConfigureWarnings(w => w.Ignore(SqlServerEventId.SavepointsDisabledBecauseOfMARS));
    }
}
