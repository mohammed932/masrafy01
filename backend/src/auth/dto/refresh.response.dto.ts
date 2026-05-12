import { ApiProperty } from '@nestjs/swagger';

export class RefreshResponseDataDto {
  @ApiProperty()
  accessToken!: string;
  @ApiProperty()
  accessTokenExpiresIn!: number;
}

export class RefreshResponseEnvelope {
  @ApiProperty()
  success!: true;
  @ApiProperty({ type: RefreshResponseDataDto })
  data!: RefreshResponseDataDto;
}
