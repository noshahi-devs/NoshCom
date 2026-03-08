using AutoMapper;
using Elicom.Entities;
using Elicom.Wallets.Dto;

namespace Elicom.Wallets.Dto
{
    public class WalletMapProfile : Profile
    {
        public WalletMapProfile()
        {
            CreateMap<Wallet, WalletDto>();
            CreateMap<SmartStoreWallet, SmartStoreWalletDto>();
            CreateMap<SmartStoreWalletTransaction, SmartStoreWalletTransactionDto>();
        }
    }
}
