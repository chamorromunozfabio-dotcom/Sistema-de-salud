import { IsString, Length, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyTwoFactorDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Código OTP de 6 dígitos', example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;

  // Opcional: token temporal de pre-auth si se implementa
  @ApiProperty({ required: false, description: 'Token temporal pre-2FA si se usa' })
  @IsString()
  tempToken?: string;
}

export class EnableTwoFactorDto {
  @ApiProperty({ example: '123456', description: 'Código para confirmar activación' })
  @IsString()
  @Length(6, 6)
  code?: string;
}
