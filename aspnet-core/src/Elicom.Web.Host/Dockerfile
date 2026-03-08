FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

WORKDIR /src
COPY ["src/Elicom.Web.Host/Elicom.Web.Host.csproj", "src/Elicom.Web.Host/"]
COPY ["src/Elicom.Web.Core/Elicom.Web.Core.csproj", "src/Elicom.Web.Core/"]
COPY ["src/Elicom.Application/Elicom.Application.csproj", "src/Elicom.Application/"]
COPY ["src/Elicom.Core/Elicom.Core.csproj", "src/Elicom.Core/"]
COPY ["src/Elicom.EntityFrameworkCore/Elicom.EntityFrameworkCore.csproj", "src/Elicom.EntityFrameworkCore/"]
WORKDIR "/src/src/Elicom.Web.Host"
RUN dotnet restore 

WORKDIR /src
COPY ["src/Elicom.Web.Host", "src/Elicom.Web.Host"]
COPY ["src/Elicom.Web.Core", "src/Elicom.Web.Core"]
COPY ["src/Elicom.Application", "src/Elicom.Application"]
COPY ["src/Elicom.Core", "src/Elicom.Core"]
COPY ["src/Elicom.EntityFrameworkCore", "src/Elicom.EntityFrameworkCore"]
WORKDIR "/src/src/Elicom.Web.Host"
RUN dotnet publish -c Release -o /publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
EXPOSE 80
ENV ASPNETCORE_HTTP_PORTS=80
WORKDIR /app
COPY --from=build /publish .
ENTRYPOINT ["dotnet", "Elicom.Web.Host.dll"]
