using System;

public class MarkOrderShippedDto
{
    public Guid OrderId { get; set; }
    public string DeliveryTrackingNumber { get; set; }
}
