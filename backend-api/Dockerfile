FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /app

# Copy csproj and restore as distinct layers
COPY ["ErpStore.Api.csproj", "./"]
COPY ["ErpStore.Application/ErpStore.Application.csproj", "ErpStore.Application/"]
COPY ["ErpStore.Domain/ErpStore.Domain.csproj", "ErpStore.Domain/"]
COPY ["ErpStore.Infrastructure/ErpStore.Infrastructure.csproj", "ErpStore.Infrastructure/"]
COPY ["modules/ElectronicBilling/src/ElectronicBilling.Core/ElectronicBilling.Core.csproj", "modules/ElectronicBilling/src/ElectronicBilling.Core/"]
RUN dotnet restore "ErpStore.Api.csproj"

# Copy everything else and build
COPY . .
RUN dotnet build "ErpStore.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ErpStore.Api.csproj" -c Release -o /app/publish

# Final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Instalar fuentes para QuestPDF (necesario en Linux)
RUN apt-get update && apt-get install -y fontconfig fonts-dejavu && rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish .

# Expose port 8080 (Render's default for web services)
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# Optimización de memoria para contenedores con RAM limitada (Render Free = 512MB)
# Usar GC Workstation (menos RAM que Server GC), limitar heap a 256MB, máxima conservación
ENV DOTNET_gcServer=0
ENV DOTNET_GCHeapHardLimit=0x10000000
ENV DOTNET_GCConserveMemory=9

ENTRYPOINT ["dotnet", "ErpStore.Api.dll"]
