import { ApiProperty } from '@nestjs/swagger';
import { AuthenticatedUserDto } from './login.response.dto';

export class MeResponseEnvelope {
  @ApiProperty()
  success!: true;
  @ApiProperty({ type: AuthenticatedUserDto })
  data!: AuthenticatedUserDto;
}
